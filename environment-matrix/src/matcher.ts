import assert from 'assert'
import * as github from '@actions/github'
import { minimatch } from 'minimatch'
import { Environment, Rule, Rules } from './rule'

type Context = Pick<typeof github.context, 'eventName' | 'ref' | 'payload'>

export const find = (context: Context, rules: Rules): Environment[] | undefined => {
  for (const rule of rules) {
    if (match(context, rule)) {
      return rule.environments
    }
  }
}

const match = (context: Context, rule: Rule): boolean => {
  if (context.eventName === 'pull_request' && rule.pull_request !== undefined) {
    const { pull_request } = context.payload
    assertPullRequestPayload(pull_request)
    return (
      minimatch(pull_request.base.ref, rule.pull_request.base) &&
      minimatch(pull_request.head.ref, rule.pull_request.head)
    )
  }
  if (context.eventName === 'push' && rule.push !== undefined) {
    return minimatch(context.ref, rule.push.ref)
  }
  return false
}

// picked from https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request
type PullRequestPayload = {
  head: {
    ref: string
  }
  base: {
    ref: string
  }
}

function assertPullRequestPayload(x: unknown): asserts x is PullRequestPayload {
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
