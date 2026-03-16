import assert from 'node:assert'
import * as fs from 'node:fs'
import { Octokit } from '@octokit/action'
import { retry } from '@octokit/plugin-retry'

export const getOctokit = () => new (Octokit.plugin(retry))()

export type Context = {
  repo: {
    owner: string
    repo: string
  }
  pullRequestNumber: number
  pullRequestHeadSHA: string
}

export const getContext = (): Context => {
  // https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables
  const payload = getPayload()
  return {
    repo: getRepo(),
    pullRequestNumber: getPullRequestNumber(payload),
    pullRequestHeadSHA: getPullRequestHeadSHA(payload),
  }
}

const getRepo = () => {
  const [owner, repo] = getEnv('GITHUB_REPOSITORY').split('/')
  return { owner, repo }
}

const getPayload = (): Record<string, unknown> => {
  const eventPath = getEnv('GITHUB_EVENT_PATH')
  return JSON.parse(fs.readFileSync(eventPath, 'utf8')) as Record<string, unknown>
}

const getPullRequest = (payload: Record<string, unknown>): object => {
  const pullRequest: unknown = payload.pull_request
  assert(pullRequest, 'This action must be run on pull_request event')
  assert(typeof pullRequest === 'object')
  assert(pullRequest !== null)
  return pullRequest
}

const getPullRequestNumber = (payload: Record<string, unknown>): number => {
  const pullRequest = getPullRequest(payload)
  assert('number' in pullRequest)
  assert(typeof pullRequest.number === 'number')
  return pullRequest.number
}

const getPullRequestHeadSHA = (payload: Record<string, unknown>): string => {
  const pullRequest = getPullRequest(payload)
  assert('head' in pullRequest)
  const head: unknown = pullRequest.head
  assert(typeof head === 'object')
  assert(head !== null)
  assert('sha' in head)
  assert(typeof head.sha === 'string')
  return head.sha
}

const getEnv = (name: string): string => {
  assert(process.env[name], `${name} is required`)
  return process.env[name]
}
