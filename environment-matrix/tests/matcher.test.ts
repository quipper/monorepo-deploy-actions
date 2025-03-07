import { findEnvironmentsFromRules, matchEnvironment } from '../src/matcher.js'
import { Rules } from '../src/rule.js'

const rules: Rules = [
  {
    pull_request: {
      head: '*/qa',
      base: '*/production',
    },
    environments: [
      {
        outputs: {
          overlay: 'pr',
          namespace: 'pr-2',
        },
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
        outputs: {
          overlay: 'pr',
          namespace: 'pr-1',
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
]

test('pull_request with any branches', async () => {
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
  expect(await findEnvironmentsFromRules(rules, context)).toStrictEqual([
    {
      outputs: {
        overlay: 'pr',
        namespace: 'pr-1',
      },
    },
  ])
})

test('pull_request with patterns', async () => {
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
  expect(await findEnvironmentsFromRules(rules, context)).toStrictEqual([
    {
      outputs: {
        overlay: 'pr',
        namespace: 'pr-2',
      },
    },
  ])
})

test('push', async () => {
  const context = {
    eventName: 'push',
    payload: {},
    ref: 'refs/heads/main',
  }
  expect(await findEnvironmentsFromRules(rules, context)).toStrictEqual([
    {
      outputs: {
        overlay: 'development',
        namespace: 'development',
      },
    },
  ])
})

test('push with no match', async () => {
  const context = {
    eventName: 'push',
    payload: {},
    ref: 'refs/tags/v1.0.0',
  }
  expect(await findEnvironmentsFromRules(rules, context)).toBeNull()
})

describe('matchEnvironment', () => {
  describe('if-file-exists', () => {
    it('returns true if the file exists', async () => {
      const environment = {
        outputs: {
          namespace: 'pr-2',
        },
        'if-file-exists': 'tests/fixtures/*',
      }
      expect(await matchEnvironment(environment)).toBeTruthy()
    })
    it('returns false if the file does not exist', async () => {
      const environment = {
        outputs: {
          namespace: 'pr-2',
        },
        'if-file-exists': 'tests/fixtures/not-found',
      }
      expect(await matchEnvironment(environment)).toBeFalsy()
    })
  })
})
