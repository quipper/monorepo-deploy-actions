import { Rules, parseRulesYAML } from '../src/rule'

test('parse a valid YAML', () => {
  const yaml = `
- pull_request:
    base: '**'
    head: '**'
  outputs:
    overlay: pr
    namespace: pr-1
- push:
    ref: refs/heads/main
  outputs:
    overlay: development
    namespace: development
`
  expect(parseRulesYAML(yaml)).toStrictEqual<Rules>([
    {
      pull_request: {
        base: '**',
        head: '**',
      },
      outputs: {
        overlay: 'pr',
        namespace: 'pr-1',
      },
    },
    {
      push: {
        ref: 'refs/heads/main',
      },
      outputs: {
        overlay: 'development',
        namespace: 'development',
      },
    },
  ])
})

test('parse an empty string', () => {
  expect(() => parseRulesYAML('')).toThrow(`invalid rules YAML:  must be array`)
})

test('parse an invalid string', () => {
  const yaml = `
- pull_request:
    base: '**'
  outputs:
    overlay: pr
    namespace: pr-1
`
  expect(() => parseRulesYAML(yaml)).toThrow(`invalid rules YAML: /0/pull_request must have property 'head'`)
})
