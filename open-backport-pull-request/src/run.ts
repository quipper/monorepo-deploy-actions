import * as core from '@actions/core'
import * as octokitPluginRetry from '@octokit/plugin-retry'
import { context, getOctokit } from '@actions/github'
import { Context } from '@actions/github/lib/context'
import { GitHub } from '@actions/github/lib/utils'

type Octokit = InstanceType<typeof GitHub>

type Inputs = {
  githubToken: string
  headBranch: string
  baseBranch: string
  skipCI: boolean
  mergePullRequest: boolean
}

type Outputs = {
  pullRequestUrl: string
  baseBranch: string
  headBranch: string
  merged: boolean
}

export const run = async (inputs: Inputs): Promise<Outputs | undefined> => {
  const octokit = getOctokit(inputs.githubToken, octokitPluginRetry.retry)
  const { baseBranch, headBranch } = inputs

  if (await hasDiff({ headBranch, baseBranch, octokit, context })) {
    return await openPullRequest(
      {
        headBranch,
        baseBranch,
        skipCI: inputs.skipCI,
        mergePullRequest: inputs.mergePullRequest,
        context,
      },
      octokit,
    )
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

type Backport = {
  headBranch: string
  baseBranch: string
  skipCI: boolean
  mergePullRequest: boolean
  context: {
    actor: string
    repo: {
      owner: string
      repo: string
    }
    runId: number
  }
}

export const getCommitMessage = (params: Backport): string => {
  // https://docs.github.com/en/actions/managing-workflow-runs/skipping-workflow-runs
  const skipCI = params.skipCI ? ' [skip ci]' : ''

  return `Backport from ${params.headBranch} into ${params.baseBranch}${skipCI}

Created by GitHub Actions
https://github.com/${params.context.repo.owner}/${params.context.repo.repo}/actions/runs/${params.context.runId}`
}

const openPullRequest = async (params: Backport, octokit: Octokit): Promise<Outputs> => {
  const commitMessage = getCommitMessage(params)

  // Add an empty commit onto the head commit.
  // If a required check is set against the base branch and the head commit is failing, we cannot merge it.
  const { data: headBranch } = await octokit.rest.repos.getBranch({
    owner: context.repo.owner,
    repo: context.repo.repo,
    branch: params.headBranch,
  })
  core.info(`Creating an empty commit on the head ${headBranch.commit.sha}`)
  const { data: workingCommit } = await octokit.rest.git.createCommit({
    owner: params.context.repo.owner,
    repo: params.context.repo.repo,
    parents: [headBranch.commit.sha],
    tree: headBranch.commit.commit.tree.sha,
    message: commitMessage,
  })

  // Create a working branch so that we can edit it if conflicted.
  // Generally, the head branch is protected and cannot be edited.
  const workingBranch = `backport-${params.headBranch.replaceAll('/', '-')}-${Date.now()}`
  core.info(`Creating a working branch ${workingBranch} from ${workingCommit.sha}`)
  await octokit.rest.git.createRef({
    owner: params.context.repo.owner,
    repo: params.context.repo.repo,
    ref: `refs/heads/${workingBranch}`,
    sha: workingCommit.sha,
  })

  core.info(`Creating a pull request ${workingBranch} -> ${params.baseBranch}`)
  const { data: pull } = await octokit.rest.pulls.create({
    owner: params.context.repo.owner,
    repo: params.context.repo.repo,
    head: workingBranch,
    base: params.baseBranch,
    title: `Backport from ${params.headBranch} into ${params.baseBranch}`,
    body: commitMessage,
  })
  core.info(`Created ${pull.html_url}`)

  if (params.mergePullRequest) {
    core.info(`Trying to merge ${pull.html_url}`)
    try {
      // When merging a pull request, GitHub API sometimes returns 405 "Base branch was modified" error.
      // octokit/plugin-retry will retry it.
      // https://github.community/t/merging-via-rest-api-returns-405-base-branch-was-modified-review-and-try-the-merge-again/13787
      const { data: merged } = await octokit.rest.pulls.merge({
        owner: params.context.repo.owner,
        repo: params.context.repo.repo,
        pull_number: pull.number,
        merge_method: 'merge',
      })
      core.info(`Merged ${pull.html_url} as ${merged.sha}`)
      // If merged, return immediately without any reviewer or assignee.
      return {
        pullRequestUrl: pull.html_url,
        baseBranch: params.baseBranch,
        headBranch: params.headBranch,
        merged: true,
      }
    } catch (e) {
      core.warning(`Could not merge ${pull.html_url}: ${String(e)}`)
    }
  }

  core.info(`Requesting a review to ${params.context.actor}`)
  try {
    await octokit.rest.pulls.requestReviewers({
      owner: params.context.repo.owner,
      repo: params.context.repo.repo,
      pull_number: pull.number,
      reviewers: [params.context.actor],
    })
  } catch (e) {
    core.info(`Could not request a review to ${params.context.actor}: ${String(e)}`)
  }

  core.info(`Adding ${params.context.actor} to assignees`)
  try {
    await octokit.rest.issues.addAssignees({
      owner: params.context.repo.owner,
      repo: params.context.repo.repo,
      issue_number: pull.number,
      assignees: [params.context.actor],
    })
  } catch (e) {
    core.info(`Could not assign ${params.context.actor}: ${String(e)}`)
  }

  return {
    pullRequestUrl: pull.html_url,
    baseBranch: params.baseBranch,
    headBranch: params.headBranch,
    merged: false,
  }
}
