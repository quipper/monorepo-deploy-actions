import assert from 'node:assert'
import * as core from '@actions/core'
import type { Octokit } from '@octokit/action'
import type * as githubContext from './github.js'

type Inputs = {
  expirationDays: number
}

export const run = async (inputs: Inputs, octokit: Octokit, context: githubContext.Context): Promise<void> => {
  assert(inputs.expirationDays > 0, 'expiration-days must be a positive number')

  assert('pull_request' in context.payload, 'This action must be run on pull_request event')
  const pullRequestHeadSHA = context.payload.pull_request.head.sha
  const pullRequestNumber = context.payload.pull_request.number

  core.info(`Fetching the head commit ${pullRequestHeadSHA}`)
  const { data: headCommit } = await octokit.rest.git.getCommit({
    owner: context.repo.owner,
    repo: context.repo.repo,
    commit_sha: pullRequestHeadSHA,
  })
  core.startGroup(`Commit ${pullRequestHeadSHA}`)
  core.info(JSON.stringify(headCommit, undefined, 2))
  core.endGroup()

  core.info(`Last commit was at ${headCommit.committer.date}`)
  if (!isExpired(Date.now, headCommit.committer.date, inputs.expirationDays)) {
    core.info(`Pull request #${pullRequestNumber} is not expired, exiting`)
    return
  }

  core.info(`Updating the pull request branch ${pullRequestNumber}}`)
  await octokit.rest.pulls.updateBranch({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pullRequestNumber,
  })
  core.info(`Updated the pull request branch ${pullRequestNumber}}`)
}

export const isExpired = (now: () => number, headCommitDate: string, expirationDays: number): boolean => {
  const headCommitTime = Date.parse(headCommitDate)
  return now() - headCommitTime >= expirationDays * 24 * 60 * 60 * 1000
}
