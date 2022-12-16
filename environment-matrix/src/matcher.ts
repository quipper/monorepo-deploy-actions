import * as github from '@actions/github'
import minimatch from 'minimatch'
import { Environment, Rule, Rules } from './types'
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
    const payload = context.payload
    if (!isPullRequestPayload(payload)) {
      throw new Error(`payload does not contain pull request fields`)
    }
    return minimatch(payload.base.ref, rule.pull_request.base) && minimatch(payload.head.ref, rule.pull_request.head)
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

const isPullRequestPayload = (x: WebhookPayload): x is PullRequestPayload => {
  const { head, base } = x
  return typeof head === 'object' && 'ref' in head && typeof base === 'object' && 'ref' in base
}
