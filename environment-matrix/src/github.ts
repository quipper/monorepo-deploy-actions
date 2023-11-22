import assert from 'assert'
import * as pluginRetry from '@octokit/plugin-retry'
import { GitHub, getOctokitOptions } from '@actions/github/lib/utils'

export type Octokit = InstanceType<typeof GitHub>

export const getOctokit = (token: string): Octokit => {
  const MyOctokit = GitHub.plugin(pluginRetry.retry)
  return new MyOctokit(getOctokitOptions(token, { previews: ['ant-man', 'flash'] }))
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
