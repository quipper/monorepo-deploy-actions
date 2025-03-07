import * as core from '@actions/core'
import * as github from '@actions/github'
import * as rule from './rule.js'
import * as matcher from './matcher.js'
import { createDeployment } from './deployment.js'
import { getOctokit } from './github.js'

type Inputs = {
  rules: string
  token: string
}

type Outputs = {
  environments: Environment[]
}

type Environment = rule.Environment & {
  'github-deployment-url'?: string
}

export const run = async (inputs: Inputs): Promise<Outputs> => {
  const rules = rule.parseRulesYAML(inputs.rules)
  core.startGroup('Rules')
  core.info(JSON.stringify(rules, undefined, 2))
  core.endGroup()

  const environments: Environment[] | undefined = matcher.find(github.context, rules)
  if (environments === undefined) {
    throw new Error(`no environment to deploy`)
  }

  core.info(`Creating GitHub Deployments for environments`)
  const octokit = getOctokit(inputs.token)
  for (const environment of environments) {
    if (environment['github-deployment']) {
      const deployment = await createDeployment(octokit, github.context, environment['github-deployment'])
      environment['github-deployment-url'] = deployment.url
    }
  }

  core.startGroup('Environments')
  core.info(JSON.stringify(environments, undefined, 2))
  core.endGroup()
  return { environments }
}
