import assert from 'node:assert'
import { describe, test } from 'node:test'
import { parseRulesYAML, type Rules } from '../src/rule.ts'

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
  assert.deepStrictEqual<Rules>(parseRulesYAML(yaml), [
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
  assert.throws(() => parseRulesYAML(''), { message: /input is empty/ })
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
    assert.throws(() => parseRulesYAML(yaml), { message: /invalid_type/ })
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
    assert.throws(() => parseRulesYAML(yaml), { message: /invalid_type/ })
  })
})
