import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import * as github from '@actions/github'
import * as pluginRetry from '@octokit/plugin-retry'

export type Octokit = ReturnType<typeof github.getOctokit>

export const getOctokit = (token: string): Octokit => {
  return github.getOctokit(token, { previews: ['ant-man', 'flash'] }, pluginRetry.retry)
}

// picked from https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request
export type PullRequestPayload = {
  head: {
    ref: string
  }
  base: {
    ref: string
  }
}

export function assertPullRequestPayload(x: unknown): asserts x is PullRequestPayload {
  assert(typeof x === 'object')
  assert(x != null)

  assert('base' in x)
  assert(typeof x.base === 'object')
  assert(x.base != null)
  assert('ref' in x.base)
  assert(typeof x.base.ref === 'string')

  assert('head' in x)
  assert(typeof x.head === 'object')
  assert(x.head != null)
  assert('ref' in x.head)
  assert(typeof x.head.ref === 'string')
}

export type Context = {
  eventName: string
  repo: {
    owner: string
    repo: string
  }
  ref: string
  payload: {
    pull_request?: unknown
  }
}

export const getContext = (): Context => {
  // https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables
  return {
    eventName: getEnv('GITHUB_EVENT_NAME'),
    repo: getRepo(),
    ref: getEnv('GITHUB_REF'),
    payload: getPayload(),
  }
}

const getRepo = () => {
  const [owner, repo] = getEnv('GITHUB_REPOSITORY').split('/')
  return { owner, repo }
}

const getPayload = (): Context['payload'] => {
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath) {
    return {}
  }
  const content = readFileSync(eventPath, 'utf8')
  return JSON.parse(content) as Context['payload']
}

const getEnv = (name: string): string => {
  assert(process.env[name], `${name} is required`)
  return process.env[name]
}
