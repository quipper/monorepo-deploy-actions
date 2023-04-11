import * as github from '@actions/github'
import { minimatch } from 'minimatch'
import { Environment, Rule, Rules } from './rule'
import { WebhookPayload } from '@actions/github/lib/interfaces'

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
    if (!isPullRequestPayload(pull_request)) {
      throw new Error(`payload.pull_request does not contain expected fields`)
    }
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
type PullRequestPayload = WebhookPayload['pull_request'] & {
  head: {
    ref: string
  }
  base: {
    ref: string
  }
}

const isPullRequestPayload = (x: WebhookPayload['pull_request']): x is PullRequestPayload => {
  if (x === undefined) {
    throw new Error(`payload.pull_request is undefined`)
  }
  const { head, base } = x
  return typeof head === 'object' && 'ref' in head && typeof base === 'object' && 'ref' in base
}
