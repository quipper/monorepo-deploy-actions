import assert from 'assert'
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
