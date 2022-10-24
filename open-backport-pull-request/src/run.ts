import * as core from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { Context } from '@actions/github/lib/context'
import { GitHub } from '@actions/github/lib/utils'

type Octokit = InstanceType<typeof GitHub>

interface Inputs {
  githubToken: string
  baseBranch: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const headBranch = getHeadBranch(context)
  const baseBranch = inputs.baseBranch
  const octokit = getOctokit(inputs.githubToken)
  const headSha = await getHeadSha(octokit, context)

  core.setOutput('base-branch', baseBranch)
  core.setOutput('head-branch', headBranch)

  if (await hasDiff({ headBranch, baseBranch, octokit, context })) {
    const pullRequestUrl = await openPullRequest({
      headBranch,
      headSha,
      baseBranch,
      octokit,
      context,
    })
    core.setOutput('pull-request-url', pullRequestUrl)
  }
}

export const getHeadBranch = (context: Context): string => {
  if (context.eventName === 'workflow_dispatch') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return context.payload.inputs.headBranch as string
  } else {
    return context.ref.replace(/^refs\/heads\//, '')
  }
}

const getHeadSha = async (octokit: Octokit, context: Context): Promise<string> => {
  if (context.eventName === 'workflow_dispatch') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const branch = context.payload.inputs.headBranch as string
    const { data: ref } = await octokit.rest.git.getRef({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: `heads/${branch}`,
    })
    return ref.object.sha
  } else {
    return context.sha
  }
}

type hasDiffParams = {
  headBranch: string
  baseBranch: string
  context: Context
  octokit: Octokit
}
const hasDiff = async (params: hasDiffParams): Promise<boolean> => {
  const compare = await params.octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', {
    owner: context.repo.owner,
    repo: context.repo.repo,
    basehead: `${params.baseBranch}...${params.headBranch}`,
  })
  return !!(compare.data.files && compare.data.files.length > 0)
}

type openPullRequestParams = {
  headBranch: string
  headSha: string
  baseBranch: string
  context: Context
  octokit: Octokit
}

const openPullRequest = async (params: openPullRequestParams): Promise<string | undefined> => {
  // Create a working branch so that we can edit it if conflicted.
  // Generally, the head branch is protected and cannot be edited.
  const workingBranch = `backport-${params.headBranch.replaceAll('/', '-')}-${Date.now()}`
  await params.octokit.rest.git.createRef({
    owner: params.context.repo.owner,
    repo: params.context.repo.repo,
    ref: `refs/heads/${workingBranch}`,
    sha: params.headSha,
  })

  core.info(`Creating a pull request ${workingBranch} -> ${params.baseBranch}`)
  const pr = await params.octokit.rest.pulls.create({
    owner: params.context.repo.owner,
    repo: params.context.repo.repo,
    head: workingBranch,
    base: params.baseBranch,
    title: `Backport ${params.headBranch} into ${params.baseBranch}`,
    body: `Created from https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
  })
  core.info(`Created ${pr.data.html_url}`)

  core.info(`Requesting a review to ${params.context.actor}`)
  try {
    await params.octokit.rest.pulls.requestReviewers({
      owner: params.context.repo.owner,
      repo: params.context.repo.repo,
      pull_number: pr.data.number,
      reviewers: [params.context.actor],
    })
  } catch (e) {
    core.info(`could not request a review to ${params.context.actor}: ${String(e)}`)
  }

  core.info(`Adding ${params.context.actor} to assignees`)
  try {
    await params.octokit.rest.issues.addAssignees({
      owner: params.context.repo.owner,
      repo: params.context.repo.repo,
      issue_number: pr.data.number,
      assignees: [params.context.actor],
    })
  } catch (e) {
    core.info(`could not assign ${params.context.actor}: ${String(e)}`)
  }

  return pr.data.html_url
}
