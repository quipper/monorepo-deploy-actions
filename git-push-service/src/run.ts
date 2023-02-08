import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git'
import * as glob from '@actions/glob'
import { arrangeManifests } from './arrange'
import { retry } from './retry'
import { updateBranchByPullRequest } from './pull'

type Inputs = {
  manifests: string
  overlay: string
  namespace: string
  service: string
  namespaceLevel: boolean
  applicationAnnotations: string[]
  destinationRepository: string
  destinationBranch: string
  prebuilt: boolean // TODO: deprecated
  updateViaPullRequest: boolean
  token: string
}

type Outputs = {
  destinationPullRequestNumber?: number
  destinationPullRequestUrl?: string
}

export const run = async (inputs: Inputs): Promise<Outputs> => {
  if (!inputs.service && !inputs.namespaceLevel) {
    throw new Error('service must be set if namespace-level is false')
  }

  const globber = await glob.create(inputs.manifests, { matchDirectories: false })
  const manifests = await globber.glob()
  core.info(`found ${manifests.length} manifest(s) in ${inputs.manifests}`)
  if (manifests.length === 0) {
    return {}
  }

  if (!inputs.updateViaPullRequest) {
    // retry when fast-forward is failed
    return await retry(async () => push(manifests, inputs), {
      maxAttempts: 50,
      waitMillisecond: 10000,
    })
  }

  // Retry in the following cases:
  // - Branch already exists, i.e., other job created the branch.
  // - Pull request is conflicted.
  //   This should not be happen if you enable the concurrency option in the workflow.
  return await retry(async () => push(manifests, inputs), {
    maxAttempts: 3,
    waitMillisecond: 10000,
  })
}

const push = async (manifests: string[], inputs: Inputs): Promise<Outputs | Error> => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-service-action-'))
  core.info(`created workspace at ${workspace}`)

  const [owner, repo] = inputs.destinationRepository.split('/')
  const project = github.context.repo.repo
  let branch = inputs.prebuilt
    ? `prebuilt/${project}/${inputs.overlay}/${github.context.ref}` // TODO: deprecated
    : `ns/${project}/${inputs.overlay}/${inputs.namespace}`
  if (inputs.destinationBranch) {
    branch = inputs.destinationBranch
  }

  core.startGroup(`checkout branch ${branch} if exist`)
  await git.init(workspace, owner, repo, inputs.token)
  const branchNotExist = (await git.checkoutIfExist(workspace, branch)) > 0
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
    return {}
  }
  const message = `Deploy ${project}/${inputs.namespace}/${inputs.service}\n\n${commitMessageFooter}`
  core.summary.addHeading(`Deploy ${project}/${inputs.namespace}/${inputs.service}`)
  await core.group(`create a commit`, () => git.commit(workspace, message))

  if (!inputs.updateViaPullRequest) {
    const code = await core.group(`push branch ${branch}`, () => git.pushByFastForward(workspace, branch))
    if (code > 0) {
      return new Error(`failed to push branch ${branch} by fast-forward`)
    }
    core.summary.addRaw(`Updated the branch: `)
    core.summary.addLink(branch, `${github.context.serverUrl}/${owner}/${repo}/tree/${branch}`)
    return {}
  }

  if (branchNotExist) {
    const code = await core.group(`push a new branch ${branch}`, () => git.pushByFastForward(workspace, branch))
    if (code > 0) {
      return new Error(`failed to push a new branch ${branch} by fast-forward`)
    }
    core.summary.addRaw(`Created a new branch: `)
    core.summary.addLink(branch, `${github.context.serverUrl}/${owner}/${repo}/tree/${branch}`)
    return {}
  }

  core.info(`updating branch ${branch} by a pull request`)
  return await updateBranchByPullRequest({
    owner,
    repo,
    title: `Deploy ${project}/${inputs.namespace}/${inputs.service}`,
    body: commitMessageFooter,
    branch,
    workspace,
    project,
    namespace: inputs.namespace,
    service: inputs.service,
    token: inputs.token,
  })
}

const commitMessageFooter = [
  'git-push-service',
  `${github.context.payload.repository?.html_url ?? ''}/commit/${github.context.sha}`,
  `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`,
].join('\n')
