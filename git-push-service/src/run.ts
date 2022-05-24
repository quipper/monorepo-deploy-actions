import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git'
import * as glob from '@actions/glob'
import { RequestError } from '@octokit/request-error'
import { arrangeManifests } from './arrange'
import { retry } from './retry'

type Inputs = {
  manifests: string
  overlay: string
  namespace: string
  service: string
  namespaceLevel: boolean
  applicationAnnotations: string[]
  destinationRepository: string
  prebuilt: boolean
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  if (!inputs.service && !inputs.namespaceLevel) {
    throw new Error('service must be set if namespace-level is false')
  }

  const globber = await glob.create(inputs.manifests, { matchDirectories: false })
  const manifests = await globber.glob()

  return await retry(async () => push(manifests, inputs), {
    maxAttempts: 50,
    waitMillisecond: 10000,
  })
}

const push = async (manifests: string[], inputs: Inputs): Promise<void | Error> => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-service-action-'))
  core.info(`created workspace at ${workspace}`)

  const [owner, repo] = inputs.destinationRepository.split('/')
  const project = github.context.repo.repo
  const branch = inputs.prebuilt
    ? `prebuilt/${project}/${inputs.overlay}/${github.context.ref}`
    : `ns/${project}/${inputs.overlay}/${inputs.namespace}`

  core.startGroup(`checkout branch ${branch} if exist`)
  await git.init(workspace, owner, repo, inputs.token)
  await git.checkoutIfExist(workspace, branch)
  core.endGroup()

  const applicationAnnotations = [
    ...inputs.applicationAnnotations,
    `github.ref=${github.context.ref}`,
    `github.sha=${github.context.sha}`,
    `github.action=git-push-service`,
  ]

  core.startGroup(`arrange manifests into workspace ${workspace}`)
  await arrangeManifests({
    workspace,
    manifests,
    service: inputs.service,
    namespace: inputs.namespace,
    namespaceLevel: inputs.namespaceLevel,
    project,
    branch,
    applicationAnnotations,
    destinationRepository: inputs.destinationRepository,
  })
  core.endGroup()

  const status = await git.status(workspace)
  if (status === '') {
    core.info('nothing to commit')
    return
  }
  const message = `Deploy ${inputs.namespace}/${inputs.service}\n\n${commitMessageFooter}`
  await git.commit(workspace, message)

  // push the branch via a pull request
  const topicBranch = `git-push-service--${inputs.namespace}--${inputs.service}--${Date.now()}`
  const code = await core.group(`push branch ${topicBranch}`, () => git.pushByFastForward(workspace, topicBranch))
  if (code > 0) {
    return new Error(`failed to push branch ${topicBranch} by fast-forward`)
  }

  const octokit = github.getOctokit(inputs.token)
  core.info(`creating a pull request from ${topicBranch} into ${branch}`)
  const { data: pull } = await octokit.rest.pulls.create({
    owner,
    repo,
    base: branch,
    head: topicBranch,
  })
  core.info(`created ${pull.html_url}`)
  try {
    const { data: merge } = await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: pull.number,
      merge_method: 'squash',
    })
    core.info(`merged ${pull.html_url} as ${merge.sha}`)
  } catch (e) {
    if (e instanceof RequestError && e.status === 422) {
      return e // retry when merge was failed
    }
    throw e
  }
}

const commitMessageFooter = [
  'git-push-service',
  `${github.context.payload.repository?.html_url ?? ''}/commit/${github.context.sha}`,
  `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`,
].join('\n')
