import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git.js'
import * as glob from '@actions/glob'
import { writeManifests } from './arrange.js'
import { retry } from './retry.js'
import { updateBranchByPullRequest } from './pull.js'

type Inputs = {
  manifests: string
  overlay: string
  namespace: string
  service: string
  applicationAnnotations: string[]
  destinationRepository: string
  destinationBranch: string
  updateViaPullRequest: boolean
  token: string
  currentHeadRef: string
  currentHeadSha: string
}

type Outputs = {
  destinationBranch: string
  destinationPullRequest?: {
    number: number
    url: string
  }
}

export const run = async (inputs: Inputs): Promise<Outputs | void> => {
  const globber = await glob.create(inputs.manifests, { matchDirectories: false })
  const manifests = await globber.glob()
  core.info(`found ${manifests.length} manifest(s) in ${inputs.manifests}`)
  if (manifests.length === 0) {
    return
  }

  if (!inputs.updateViaPullRequest) {
    // Retry when fast-forward is failed
    const outputs = await retry(async () => push(manifests, inputs), {
      maxAttempts: 50,
      waitMillisecond: 10000,
    })
    if (outputs) {
      writeSummary(inputs, outputs)
    }
    await core.summary.write()
    return outputs
  }

  // Retry in the following cases:
  // - Branch already exists, i.e., other job created the branch.
  // - Pull request is conflicted.
  //   This should not be happen if you enable the concurrency option in the workflow.
  const outputs = await retry(async () => push(manifests, inputs), {
    maxAttempts: 3,
    waitMillisecond: 10000,
  })
  if (outputs) {
    writeSummary(inputs, outputs)
  }
  await core.summary.write()
  return outputs
}

const push = async (manifests: string[], inputs: Inputs): Promise<Outputs | void | Error> => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-service-action-'))
  core.info(`Created a workspace at ${workspace}`)

  const [owner, repo] = inputs.destinationRepository.split('/')
  const project = github.context.repo.repo
  let destinationBranch = `ns/${project}/${inputs.overlay}/${inputs.namespace}`
  if (inputs.destinationBranch) {
    destinationBranch = inputs.destinationBranch
  }

  core.startGroup(`Checking out the branch ${destinationBranch} if exist`)
  await git.init(workspace, owner, repo, inputs.token)
  const branchNotExist = (await git.checkoutIfExist(workspace, destinationBranch)) > 0
  core.endGroup()

  core.startGroup(`Writing the manifests into workspace ${workspace}`)
  await writeManifests({
    workspace,
    manifests,
    service: inputs.service,
    namespace: inputs.namespace,
    project,
    branch: destinationBranch,
    applicationAnnotations: inputs.applicationAnnotations,
    destinationRepository: inputs.destinationRepository,
    currentHeadRef: inputs.currentHeadRef,
    currentHeadSha: inputs.currentHeadSha,
  })
  core.endGroup()

  const status = await git.status(workspace)
  if (status === '') {
    core.info('Nothing to commit')
    return
  }
  const message = `Deploy ${project}/${inputs.namespace}/${inputs.service}\n\n${commitMessageFooter}`
  await core.group(`Creating a commit`, () => git.commit(workspace, message))

  if (!inputs.updateViaPullRequest) {
    const code = await core.group(`Pushing the branch ${destinationBranch}`, () =>
      git.pushByFastForward(workspace, destinationBranch),
    )
    if (code > 0) {
      return new Error(`failed to push branch ${destinationBranch} by fast-forward`)
    }
    return { destinationBranch: destinationBranch }
  }

  if (branchNotExist) {
    const code = await core.group(`Pushing a new branch ${destinationBranch}`, () =>
      git.pushByFastForward(workspace, destinationBranch),
    )
    if (code > 0) {
      return new Error(`failed to push a new branch ${destinationBranch} by fast-forward`)
    }
    return { destinationBranch: destinationBranch }
  }

  core.info(`Updating branch ${destinationBranch} by a pull request`)
  const destinationPullRequest = await updateBranchByPullRequest({
    owner,
    repo,
    title: `Deploy ${project}/${inputs.namespace}/${inputs.service}`,
    body: commitMessageFooter,
    branch: destinationBranch,
    workspace,
    project,
    namespace: inputs.namespace,
    service: inputs.service,
    token: inputs.token,
  })
  if (destinationPullRequest instanceof Error) {
    return destinationPullRequest
  }
  return { destinationBranch, destinationPullRequest }
}

const writeSummary = (inputs: Inputs, outputs: Outputs) => {
  core.summary.addHeading(`git-push-service summary`, 2)

  core.summary.addRaw(`<p>`)
  core.summary.addRaw(`Pushed the service ${inputs.service} to the namespace branch: `)
  const destinationBranchUrl = `${github.context.serverUrl}/${inputs.destinationRepository}/tree/${outputs.destinationBranch}`
  core.summary.addLink(destinationBranchUrl, destinationBranchUrl)
  core.summary.addRaw(`</p>`)

  if (outputs.destinationPullRequest) {
    core.summary.addRaw(`<p>`)
    core.summary.addRaw(`See the pull request: `)
    core.summary.addLink(outputs.destinationPullRequest.url, outputs.destinationPullRequest.url)
    core.summary.addRaw(`</p>`)
  }
}

const commitMessageFooter = [
  'git-push-service',
  `${github.context.payload.repository?.html_url ?? ''}/commit/${github.context.sha}`,
  `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`,
].join('\n')
