import assert from 'assert'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { parseRulesYAML } from './rule'
import { find } from './matcher'
import { createDeployment } from './deployment'
import { getOctokit } from './github'

type Inputs = {
  rules: string
  service: string
  token: string
}

type Outputs = {
  outputs: Record<string, string>
  githubDeploymentURL?: string
}

export const run = async (inputs: Inputs): Promise<Outputs> => {
  const rules = parseRulesYAML(inputs.rules)
  core.info(`rules: ${JSON.stringify(rules, undefined, 2)}`)
  const outputs = find(github.context, rules)
  if (outputs === undefined) {
    throw new Error(`no environment to deploy`)
  }

  if (!inputs.service) {
    return { outputs }
  }

  core.info(`Creating a GitHub Deployment for the environment`)
  const { overlay, namespace } = outputs
  assert(overlay, `overlay is required in the rule outputs`)
  assert(namespace, `namespace is required in the rule outputs`)
  assert(inputs.token, `inputs.token is required`)
  const octokit = getOctokit(inputs.token)
  const githubDeploymentURL = await createDeployment(octokit, github.context, overlay, namespace, inputs.service)
  return { outputs, githubDeploymentURL }
}
