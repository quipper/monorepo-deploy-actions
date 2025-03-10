import * as core from '@actions/core'
import * as github from '@actions/github'
import { parseRulesYAML } from './rule.js'
import { findEnvironmentsFromRules } from './matcher.js'
import { createDeployment } from './deployment.js'
import { getOctokit } from './github.js'

type Inputs = {
  rules: string
  token: string
}

type Outputs = {
  json: Record<string, string>[]
}

export const run = async (inputs: Inputs): Promise<Outputs> => {
  const rules = parseRulesYAML(inputs.rules)
  core.startGroup('Rules')
  core.info(JSON.stringify(rules, undefined, 2))
  core.endGroup()

  const environments = await findEnvironmentsFromRules(rules, github.context)
  if (environments === undefined) {
    throw new Error(`no environment to deploy`)
  }

  core.info(`Creating GitHub Deployments for environments`)
  const octokit = getOctokit(inputs.token)
  for (const environment of environments) {
    if (environment['github-deployment']) {
      const deployment = await createDeployment(octokit, github.context, environment['github-deployment'])
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
