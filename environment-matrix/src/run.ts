import * as core from '@actions/core'
import * as github from '@actions/github'
import { Environment, parseRulesYAML } from './rule'
import { find } from './matcher'
import { createGitHubDeploymentForEnvironments } from './deployment'
import { getOctokit } from './github'

type Inputs = {
  rules: string
  token: string
}

type Outputs = {
  environments: Environment[]
}

export const run = async (inputs: Inputs): Promise<Outputs> => {
  const rules = parseRulesYAML(inputs.rules)
  core.info(`rules: ${JSON.stringify(rules, undefined, 2)}`)
  const environments = find(github.context, rules)
  if (environments === undefined) {
    throw new Error(`no environment to deploy`)
  }
  core.info(`environments = ${JSON.stringify(environments, undefined, 2)}`)

  core.info(`Creating GitHub Deployments if needed`)
  const octokit = getOctokit(inputs.token)
  await createGitHubDeploymentForEnvironments(octokit, github.context, environments)
  core.info(`environments = ${JSON.stringify(environments, undefined, 2)}`)
  return {
    environments,
  }
}
