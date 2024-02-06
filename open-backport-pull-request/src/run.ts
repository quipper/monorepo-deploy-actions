import * as core from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { Context } from '@actions/github/lib/context'
import { GitHub } from '@actions/github/lib/utils'

type Octokit = InstanceType<typeof GitHub>

type Inputs = {
  githubToken: string
  headBranch: string
  baseBranch: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const octokit = getOctokit(inputs.githubToken)

  const { baseBranch, headBranch } = inputs
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

const openPullRequest = async (params: openPullRequestParams): Promise<string> => {
  const commitMessage = `Backport from ${params.headBranch} into ${params.baseBranch}

Created by GitHub Actions
https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`

  // Add an empty commit onto the head commit.
  // If a required check is set against the base branch and the head commit is failing, we cannot merge it.
  const { data: headBranch } = await params.octokit.rest.repos.getBranch({
    owner: params.context.repo.owner,
    repo: params.context.repo.repo,
    branch: params.headBranch,
  })
  core.info(`Creating an empty commit on the head ${headBranch.commit.sha}`)
  const { data: workingCommit } = await params.octokit.rest.git.createCommit({
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
  await params.octokit.rest.git.createRef({
    owner: params.context.repo.owner,
    repo: params.context.repo.repo,
    ref: `refs/heads/${workingBranch}`,
    sha: workingCommit.sha,
  })

  core.info(`Creating a pull request ${workingBranch} -> ${params.baseBranch}`)
  const pr = await params.octokit.rest.pulls.create({
    owner: params.context.repo.owner,
    repo: params.context.repo.repo,
    head: workingBranch,
    base: params.baseBranch,
    title: `Backport from ${params.headBranch} into ${params.baseBranch}`,
    body: commitMessage,
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
