import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import { WebhookPayload } from '@actions/github/lib/interfaces'
import { GitHub } from '@actions/github/lib/utils'
import { getOctokit } from './github'

const workflowRunUrl = `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`

type Octokit = InstanceType<typeof GitHub>

type Inputs = {
  body: string
  token: string
  services: string[]
  baseBranch: string
  headBranch: string
}

const run = async (inputs: Inputs) => {
  const octokit = getOctokit(inputs.token)
  await exec.exec('git', ['config', 'user.name', 'github-actions'])
  await exec.exec('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'])

  core.info(`Creating a commit for single release services`)
  await exec.exec('git', ['commit', '--allow-empty', '-m', `Single release\n\n${workflowRunUrl}`])

  core.info(`Updating ${inputs.headBranch} branches`)
  for (const service of inputs.services) {
    await exec.exec('git', ['push', '-f', 'origin', `HEAD:refs/heads/${service}/${inputs.headBranch}`])
  }
  for (const service of inputs.services) {
    await createPullOrBaseBranch(octokit, service, inputs.headBranch, inputs.baseBranch, inputs.body)
  }
  await core.summary.write()
}

const createPullOrBaseBranch = async (octokit: Octokit, service: string, headBranch: string, baseBranch: string, body: string) => {
  const base = `${service}/${baseBranch}`
  if (await checkIfBranchExists(base)) {
    return createPull(octokit, service, headBranch, body)
  }

  core.info(`Creating new base branch: ${base}`)
  await exec.exec('git', ['push', 'origin', base])
  core.summary.addRaw(`Created new base branch: ${base}`, true)
}

const checkIfBranchExists = async (ref: string): Promise<boolean> => {
  const code = await exec.exec('git', ['ls-remote', '--exit-code', 'origin', ref], { ignoreReturnCode: true })
  // git ls-remote --exit-code:
  // Exit with status "2" when no matching refs are found in the remote repository.
  // Usually the command exits with status "0" to indicate it
  // successfully talked with the remote repository, whether it found any matching refs.
  if (code === 0) {
    return true
  }
  if (code === 2) {
    return false
  }
  throw new Error(`git ls-remote returned with code ${code}`)
}

const createPull = async (octokit: Octokit, service: string, headBranch: string, baseBranch: string, body: string) => {
  const base = `${service}/${baseBranch}`
  const head = `${service}/${headBranch}`
  core.info(`Creating a pull request`)
  core.info(`base: ${base}`)
  core.info(`head: ${head}`)

  const { data: exists } = await octokit.rest.pulls.list({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    base,
    head,
  })
  if (exists.length > 0) {
    core.info(`already exists: ${exists.map((pull) => pull.html_url).join()}`)
    const pull = exists[0]
    core.summary.addRaw(`Already exists [#${pull.number} ${pull.title}](${pull.html_url})`, true)
    return
  }

  const { data: pull } = await octokit.rest.pulls.create({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    base,
    head,
    title: `Single release ${service} at ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
    body,
  })
  core.info(`created ${pull.html_url}`)
  core.summary.addRaw(`Created [#${pull.number} ${pull.title}](${pull.html_url})`, true)

  await octokit.rest.pulls.requestReviewers({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    pull_number: pull.number,
    reviewers: [github.context.actor],
  })
  await octokit.rest.issues.addAssignees({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: pull.number,
    assignees: [github.context.actor],
  })
  await octokit.rest.issues.addLabels({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: pull.number,
    labels: [`single-release/${service}`],
  })
  return
}

type WorkflowDispatchWebhookPayload = {
  inputs: Record<string, string>
}

const isWorkflowDispatchWebhookPayload = (payload: WebhookPayload): payload is WorkflowDispatchWebhookPayload =>
  typeof payload.inputs === 'object'

const getServicesFromPayload = (payload: WebhookPayload): string[] => {
  if (!isWorkflowDispatchWebhookPayload(payload)) {
    throw new Error(`payload does not contain inputs`)
  }
  const services = []
  for (const [k, v] of Object.entries(payload.inputs)) {
    if (k.startsWith('service--') && v === 'true') {
      const service = k.replace(/^service--/, '')
      services.push(service)
    }
  }
  return services
}

const main = async () => {
  const service = core.getInput('service')
  if (service) {
    return await run({
      services: [service],
      body: core.getInput('body', { required: true }),
      token: core.getInput('token', { required: true }),
      baseBranch: core.getInput('baseBranch', { required: true }),
      headBranch: core.getInput('headBranch', { required: true }),
    })
  }

  // Parse workflow_disparch payload in form of `{"service--NAME": "true"}`.
  // See also the caller workflows.
  return await run({
    services: getServicesFromPayload(github.context.payload),
    body: core.getInput('body', { required: true }),
    token: core.getInput('token', { required: true }),
    baseBranch: core.getInput('baseBranch', { required: true }),
    headBranch: core.getInput('headBranch', { required: true }),
  })
}

main().catch((e) => core.setFailed(e instanceof Error ? e : String(e)))
