import * as yaml from 'js-yaml'
import Ajv, { JTDSchemaType } from 'ajv/dist/jtd'

export type Environment = Record<string, string>

const EnvironmentSchema: JTDSchemaType<Environment> = {
  values: {
    type: 'string',
  },
}

export type Rule = {
  pull_request?: {
    base: string
    head: string
  }
  push?: {
    ref: string
  }
  environments: Environment[]
}

const RuleSchema: JTDSchemaType<Rule> = {
  properties: {
    environments: {
      elements: EnvironmentSchema,
    },
  },
  optionalProperties: {
    pull_request: {
      properties: {
        base: {
          type: 'string',
        },
        head: {
          type: 'string',
        },
      },
    },
    push: {
      properties: {
        ref: {
          type: 'string',
        },
      },
    },
  },
}

export type Rules = Rule[]

const rulesSchema: JTDSchemaType<Rules> = {
  elements: RuleSchema,
}

const ajv = new Ajv()
export const validateRules = ajv.compile(rulesSchema)

export const parseRulesYAML = (s: string): Rules => {
  const rules = yaml.load(s)
  if (!validateRules(rules)) {
    if (validateRules.errors) {
      throw new Error(
        `invalid rules YAML: ${validateRules.errors.map((e) => `${e.instancePath} ${e.message || ''}`).join(', ')}`,
      )
    }
    throw new Error('invalid rules YAML')
  }
  return rules
}
