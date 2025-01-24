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
  destinationPullRequestNumber?: number
  destinationPullRequestUrl?: string
}

export const run = async (inputs: Inputs): Promise<Outputs> => {
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
  core.info(`Created a workspace at ${workspace}`)

  const [owner, repo] = inputs.destinationRepository.split('/')
  const project = github.context.repo.repo
  let branch = `ns/${project}/${inputs.overlay}/${inputs.namespace}`
  if (inputs.destinationBranch) {
    branch = inputs.destinationBranch
  }

  core.startGroup(`Checking out the branch ${branch} if exist`)
  await git.init(workspace, owner, repo, inputs.token)
  const branchNotExist = (await git.checkoutIfExist(workspace, branch)) > 0
  core.endGroup()

  core.startGroup(`Writing the manifests into workspace ${workspace}`)
  await writeManifests({
    workspace,
    manifests,
    service: inputs.service,
    namespace: inputs.namespace,
    project,
    branch,
    applicationAnnotations: inputs.applicationAnnotations,
    destinationRepository: inputs.destinationRepository,
    currentHeadRef: inputs.currentHeadRef,
    currentHeadSha: inputs.currentHeadSha,
  })
  core.endGroup()

  const status = await git.status(workspace)
  if (status === '') {
    core.info('Nothing to commit')
    return {}
  }
  const message = `Deploy ${project}/${inputs.namespace}/${inputs.service}\n\n${commitMessageFooter}`
  core.summary.addHeading(`Deploy ${project}/${inputs.namespace}/${inputs.service}`)
  await core.group(`Creating a commit`, () => git.commit(workspace, message))

  if (!inputs.updateViaPullRequest) {
    const code = await core.group(`Pushing the branch ${branch}`, () => git.pushByFastForward(workspace, branch))
    if (code > 0) {
      return new Error(`failed to push branch ${branch} by fast-forward`)
    }
    core.summary.addRaw(`Updated the branch: `)
    core.summary.addLink(branch, `${github.context.serverUrl}/${owner}/${repo}/tree/${branch}`)
    return {}
  }

  if (branchNotExist) {
    const code = await core.group(`Pushing a new branch ${branch}`, () => git.pushByFastForward(workspace, branch))
    if (code > 0) {
      return new Error(`failed to push a new branch ${branch} by fast-forward`)
    }
    core.summary.addRaw(`Created a new branch: `)
    core.summary.addLink(branch, `${github.context.serverUrl}/${owner}/${repo}/tree/${branch}`)
    return {}
  }

  core.info(`Updating branch ${branch} by a pull request`)
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
