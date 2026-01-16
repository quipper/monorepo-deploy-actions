import { describe, expect, test } from 'vitest'
import { parseRulesYAML, type Rules } from '../src/rule.js'

test('parse a valid YAML', () => {
  const yaml = `
- pull_request:
    base: '**'
    head: '**'
  environments:
    - github-deployment:
        environment: pr/pr-1/backend
      outputs:
        overlay: pr
        namespace: pr-1
- push:
    ref: refs/heads/main
  environments:
    - outputs:
        overlay: development
        namespace: development
`
  expect(parseRulesYAML(yaml)).toStrictEqual<Rules>([
    {
      pull_request: {
        base: '**',
        head: '**',
      },
      environments: [
        {
          outputs: {
            overlay: 'pr',
            namespace: 'pr-1',
          },
          'github-deployment': {
            environment: 'pr/pr-1/backend',
          },
        },
      ],
    },
    {
      push: {
        ref: 'refs/heads/main',
      },
      environments: [
        {
          outputs: {
            overlay: 'development',
            namespace: 'development',
          },
        },
      ],
    },
  ])
})

test('parse an empty string', () => {
  expect(() => parseRulesYAML('')).toThrow(`invalid_type`)
})

describe('parse an invalid object', () => {
  test('missing field in pull_request', () => {
    const yaml = `
- pull_request:
    base: '**'
  environments:
    - outputs:
        overlay: pr
        namespace: pr-1
`
    expect(() => parseRulesYAML(yaml)).toThrow(`invalid_type`)
  })

  test('missing field in environment', () => {
    const yaml = `
- pull_request:
    base: '**'
    head: '**'
  environments:
    - overlay: pr
      namespace: pr-1
`
    expect(() => parseRulesYAML(yaml)).toThrow(`invalid_type`)
  })
})
