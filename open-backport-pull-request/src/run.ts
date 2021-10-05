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

  core.setOutput('base-branch', baseBranch)
  core.setOutput('head-branch', headBranch)

  if (await hasDiff({ headBranch, baseBranch, octokit, context })) {
    const pullRequestUrl = await openPullRequest({
      headBranch,
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
  baseBranch: string
  context: Context
  octokit: Octokit
}
const openPullRequest = async (params: openPullRequestParams): Promise<string | undefined> => {
  try {
    const pr = await params.octokit.rest.pulls.create({
      owner: params.context.repo.owner,
      repo: params.context.repo.repo,
      head: params.headBranch,
      base: params.baseBranch,
      title: `Backport ${params.headBranch} into ${params.baseBranch}`,
      body: `Created from https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
    })
    return pr.data.html_url
  } catch (err) {
    console.error(err)

    if (isUnprocessableEntityError(err)) {
      core.warning('Pull Request already exists')
    } else {
      core.error('Unknown failure: ${err.message}')
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isUnprocessableEntityError = (err: any): boolean => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return typeof err === 'object' && 'status' in err && err.status === 422
}
