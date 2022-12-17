import { find } from '../src/matcher'
import { Rules } from '../src/rule'

const rules: Rules = [
  {
    pull_request: {
      head: '*/qa',
      base: '*/production',
    },
    environments: [
      {
        overlay: 'pr',
        namespace: 'pr-2',
      },
    ],
  },
  {
    pull_request: {
      head: '**',
      base: '**',
    },
    environments: [
      {
        overlay: 'pr',
        namespace: 'pr-1',
      },
    ],
  },
  {
    push: {
      ref: 'refs/heads/main',
    },
    environments: [
      {
        overlay: 'development',
        namespace: 'development',
      },
    ],
  },
]

test('pull_request with any branches', () => {
  const context = {
    eventName: 'pull_request',
    payload: {
      pull_request: {
        number: 1,
        head: { ref: 'topic' },
        base: { ref: 'main' },
      },
    },
    ref: 'refs/pull/1/merge',
  }
  expect(find(context, rules)).toStrictEqual([
    {
      overlay: 'pr',
      namespace: 'pr-1',
    },
  ])
})

test('pull_request with patterns', () => {
  const context = {
    eventName: 'pull_request',
    payload: {
      pull_request: {
        number: 2,
        head: { ref: 'microservice/qa' },
        base: { ref: 'microservice/production' },
      },
    },
    ref: 'refs/pull/2/merge',
  }
  expect(find(context, rules)).toStrictEqual([
    {
      overlay: 'pr',
      namespace: 'pr-2',
    },
  ])
})

test('push', () => {
  const context = {
    eventName: 'push',
    payload: {},
    ref: 'refs/heads/main',
  }
  expect(find(context, rules)).toStrictEqual([
    {
      overlay: 'development',
      namespace: 'development',
    },
  ])
})

test('push with no match', () => {
  const context = {
    eventName: 'push',
    payload: {},
    ref: 'refs/tags/v1.0.0',
  }
  expect(find(context, rules)).toBeUndefined()
})
