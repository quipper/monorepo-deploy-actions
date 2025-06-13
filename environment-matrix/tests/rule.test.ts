import { Rules, parseRulesYAML } from '../src/rule.js'
import { test, describe, expect } from 'vitest'

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
  expect(() => parseRulesYAML('')).toThrow(`invalid rules YAML:  must be array`)
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
    expect(() => parseRulesYAML(yaml)).toThrow(`invalid rules YAML: /0/pull_request must have property 'head'`)
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
    expect(() => parseRulesYAML(yaml)).toThrow(`invalid rules YAML: /0/environments/0 must have property 'outputs'`)
  })
})
