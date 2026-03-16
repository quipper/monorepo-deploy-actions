import * as core from '@actions/core'
import type { Octokit } from '@octokit/action'
import { createDeployment } from './deployment.js'
import type * as github from './github.js'
import { findEnvironmentsFromRules } from './matcher.js'
import { parseRulesYAML, type Rules } from './rule.js'

type Inputs = {
  rules: string
}

type Outputs = {
  json: Record<string, string>[]
}

export const run = async (inputs: Inputs, octokit: Octokit, context: github.Context): Promise<Outputs> => {
  let rules: Rules
  try {
    rules = parseRulesYAML(inputs.rules)
  } catch (error) {
    throw new Error(`Invalid rules. Check the syntax error: ${error}`, { cause: error })
  }
  core.startGroup('Rules')
  core.info(JSON.stringify(rules, undefined, 2))
  core.endGroup()

  const environments = await findEnvironmentsFromRules(rules, context)
  if (environments === undefined) {
    throw new Error(`no environment to deploy`)
  }

  core.info(`Creating GitHub Deployments for environments`)
  for (const environment of environments) {
    if (environment['github-deployment']) {
      const deployment = await createDeployment(octokit, context, environment['github-deployment'])
      environment.outputs['github-deployment-url'] = deployment.url
    }
  }

  core.startGroup('Environments')
  core.info(JSON.stringify(environments, undefined, 2))
  core.endGroup()
  return {
    json: environments.map((environment) => environment.outputs),
  }
}
