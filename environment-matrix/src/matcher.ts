import * as github from '@actions/github'
import { minimatch } from 'minimatch'
import { Environment, Rule, Rules } from './rule'
import { assertPullRequestPayload } from './github'

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
    assertPullRequestPayload(context.payload.pull_request)
    return (
      minimatch(context.payload.pull_request.base.ref, rule.pull_request.base) &&
      minimatch(context.payload.pull_request.head.ref, rule.pull_request.head)
    )
  }
  if (context.eventName === 'push' && rule.push !== undefined) {
    return minimatch(context.ref, rule.push.ref)
  }
  return false
}
