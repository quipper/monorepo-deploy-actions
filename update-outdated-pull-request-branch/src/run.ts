import assert from 'node:assert'
import * as core from '@actions/core'
import * as github from '@actions/github'
import type * as githubContext from './github.js'

type Inputs = {
  expirationDays: number
  token: string
}

export const run = async (inputs: Inputs, context: githubContext.Context): Promise<void> => {
  assert(inputs.expirationDays > 0, 'expiration-days must be a positive number')
  const octokit = github.getOctokit(inputs.token)

  core.info(`Fetching the head commit ${context.pullRequestHeadSHA}`)
  const { data: headCommit } = await octokit.rest.git.getCommit({
    owner: context.repo.owner,
    repo: context.repo.repo,
    commit_sha: context.pullRequestHeadSHA,
  })
  core.startGroup(`Commit ${context.pullRequestHeadSHA}`)
  core.info(JSON.stringify(headCommit, undefined, 2))
  core.endGroup()

  core.info(`Last commit was at ${headCommit.committer.date}`)
  if (!isExpired(Date.now, headCommit.committer.date, inputs.expirationDays)) {
    core.info(`Pull request #${context.pullRequestNumber} is not expired, exiting`)
    return
  }

  core.info(`Updating the pull request branch ${context.pullRequestNumber}}`)
  await octokit.rest.pulls.updateBranch({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.pullRequestNumber,
  })
  core.info(`Updated the pull request branch ${context.pullRequestNumber}}`)
}

export const isExpired = (now: () => number, headCommitDate: string, expirationDays: number): boolean => {
  const headCommitTime = Date.parse(headCommitDate)
  return now() - headCommitTime >= expirationDays * 24 * 60 * 60 * 1000
}
