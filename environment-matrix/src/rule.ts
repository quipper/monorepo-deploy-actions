import * as yaml from 'js-yaml'
import { z } from 'zod'

const GitHubDeployment = z
  .object({
    environment: z.string().describe(`The name of the environment`),
  })
  .describe(`GitHub deployment to create`)

export type GitHubDeployment = z.infer<typeof GitHubDeployment>

const Environment = z
  .object({
    outputs: z.record(z.string(), z.string()).describe(`Key-value pairs of outputs to return`),
    'if-file-exists': z
      .string()
      .optional()
      .describe(`If set, this environment is evaluated only if the glob pattern matches at least one file`),
    'github-deployment': GitHubDeployment.optional().describe(
      `If set, create a GitHub deployment for this environment`,
    ),
  })
  .describe(`An environment evaluated when the conditions match`)

export type Environment = z.infer<typeof Environment>

const Rule = z.object({
  pull_request: z
    .object({
      base: z.string().describe(`A glob pattern of base branch`),
      head: z.string().describe(`A glob pattern of head branch`),
    })
    .optional()
    .describe(`Conditions for pull_request events`),
  push: z
    .object({
      ref: z.string().describe(`A glob pattern of ref. For example: refs/heads/main`),
    })
    .optional()
    .describe(`Conditions for push events`),
  environments: z.array(Environment).describe(`List of environments to return`),
})

export type Rule = z.infer<typeof Rule>

const Rules = z.array(Rule)

export type Rules = z.infer<typeof Rules>

export const parseRulesYAML = (s: string): Rules => {
  return Rules.parse(yaml.load(s))
}
