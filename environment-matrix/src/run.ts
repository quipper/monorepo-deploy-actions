import * as core from '@actions/core'
import * as github from '@actions/github'
import * as yaml from 'js-yaml'
import { Environment, validateRules } from './types'
import { find } from './matcher'

type Inputs = {
  rules: string
}

type Outputs = {
  environments: Environment[]
}

// eslint-disable-next-line @typescript-eslint/require-await
export const run = async (inputs: Inputs): Promise<Outputs> => {
  const rules = yaml.load(inputs.rules)
  if (!validateRules(rules)) {
    throw validateRules.errors
  }
  core.info(`valid rules: ${JSON.stringify(rules, undefined, 2)}`)
  const environments = find(github.context, rules)
  if (environments === undefined) {
    throw new Error(`no environment to deploy`)
  }
  core.info(`environments: ${JSON.stringify(environments, undefined, 2)}`)
  return {
    environments,
  }
}
