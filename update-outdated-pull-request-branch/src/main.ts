import * as core from '@actions/core'
import * as github from '@actions/github'
import { run } from './run'
import assert from 'assert'

const main = async (): Promise<void> => {
  await run({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    pullRequestNumber: github.context.issue.number,
    pullRequestHeadSHA: getPullRequestHeadSHA(),
    expirationDays: Number(core.getInput('expiration-days')),
    token: core.getInput('token'),
  })
}

const getPullRequestHeadSHA = (): string => {
  assert(github.context.payload.pull_request, 'This action must be run on pull_request event')
  const head: unknown = github.context.payload.pull_request.head
  assert(typeof head === 'object')
  assert(head !== null)
  assert('sha' in head)
  assert(typeof head.sha === 'string')
  return head.sha
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
