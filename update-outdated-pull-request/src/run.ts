import * as core from '@actions/core'
import * as github from '@actions/github'
import assert from 'assert'

type Inputs = {
  owner: string
  repo: string
  pullRequestNumber: number
  pullRequestHeadSHA: string
  expirationDays: number
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  assert(inputs.expirationDays > 0, 'expiration-days must be a positive number')
  const octokit = github.getOctokit(inputs.token)

  core.info(`Fetching the head commit ${inputs.pullRequestHeadSHA}`)
  const { data: headCommit } = await octokit.rest.git.getCommit({
    owner: inputs.owner,
    repo: inputs.repo,
    commit_sha: inputs.pullRequestHeadSHA,
  })
  core.startGroup(`Commit ${inputs.pullRequestHeadSHA}`)
  core.info(JSON.stringify(headCommit, undefined, 2))
  core.endGroup()

  if (isExpired(Date.now, headCommit.committer.date, inputs.expirationDays)) {
    core.info(`Pull request #${inputs.pullRequestNumber} is not expired, exiting`)
    return
  }

  core.info(`Updating the pull request branch #{inputs.pullRequestNumber}}`)
  await octokit.rest.pulls.updateBranch({
    owner: inputs.owner,
    repo: inputs.repo,
    pull_number: inputs.pullRequestNumber,
  })
  core.info(`Updated the pull request branch #{inputs.pullRequestNumber}}`)
}

export const isExpired = (now: () => number, headCommitDate: string, expirationDays: number): boolean => {
  const headCommitTime = Date.parse(headCommitDate)
  return now() - headCommitTime >= expirationDays * 24 * 60 * 60 * 1000
}
