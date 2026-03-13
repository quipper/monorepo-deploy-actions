import * as glob from '@actions/glob'
import { minimatch } from 'minimatch'
import { assertPullRequestPayload, type Context } from './github.js'
import type { Environment, Rule, Rules } from './rule.js'

export const findEnvironmentsFromRules = async (rules: Rules, context: Context): Promise<Environment[] | undefined> => {
  for (const rule of rules) {
    if (matchRule(rule, context)) {
      const environments = []
      for (const environment of rule.environments) {
        if (await matchEnvironment(environment)) {
          environments.push(environment)
        }
      }
      return environments
    }
  }
}

const matchRule = (rule: Rule, context: Context): boolean => {
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

export const matchEnvironment = async (environment: Environment): Promise<boolean> => {
  if (environment['if-file-exists']) {
    const globber = await glob.create(environment['if-file-exists'], { matchDirectories: false })
    const matches = await globber.glob()
    return matches.length > 0
  }
  return true
}
