import assert from 'assert'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { Environment, parseRulesYAML } from './rule'
import { find } from './matcher'
import { EnvironmentWithDeployment, createGitHubDeploymentForEnvironments } from './deployment'
import { getOctokit } from './github'

type Inputs = {
  rules: string
  service: string
  token: string
}

type Outputs = {
  environments: Environment[] | EnvironmentWithDeployment[]
}

export const run = async (inputs: Inputs): Promise<Outputs> => {
  const rules = parseRulesYAML(inputs.rules)
  core.info(`rules: ${JSON.stringify(rules, undefined, 2)}`)
  const environments = find(github.context, rules)
  if (environments === undefined) {
    throw new Error(`no environment to deploy`)
  }

  core.info(`environments = ${JSON.stringify(environments, undefined, 2)}`)
  if (!inputs.service) {
    return { environments }
  }

  core.info(`Creating GitHub Deployments for environments`)
  assert(inputs.token, `inputs.token is required`)
  const octokit = getOctokit(inputs.token)
  const environmentsWithDeployments = await createGitHubDeploymentForEnvironments(
    octokit,
    github.context,
    environments,
    inputs.service,
  )
  core.info(`environmentsWithDeployments = ${JSON.stringify(environmentsWithDeployments, undefined, 2)}`)
  return { environments: environmentsWithDeployments }
}
