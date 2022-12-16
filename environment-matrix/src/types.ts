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
