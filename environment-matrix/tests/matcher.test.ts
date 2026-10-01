import assert from 'node:assert'
import { describe, it, test } from 'node:test'
import type { WebhookEvent } from '@octokit/webhooks-types'
import { findEnvironmentsFromRules, matchEnvironment } from '../src/matcher.ts'
import type { Rules } from '../src/rule.ts'

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
    repo: { owner: 'owner', repo: 'repo' },
    payload: {
      pull_request: {
        number: 1,
        head: { ref: 'topic' },
        base: { ref: 'main' },
      },
    } as WebhookEvent,
    ref: 'refs/pull/1/merge',
  }
  assert.deepStrictEqual(await findEnvironmentsFromRules(rules, context), [
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
    repo: { owner: 'owner', repo: 'repo' },
    payload: {
      pull_request: {
        number: 2,
        head: { ref: 'microservice/qa' },
        base: { ref: 'microservice/production' },
      },
    } as WebhookEvent,
    ref: 'refs/pull/2/merge',
  }
  assert.deepStrictEqual(await findEnvironmentsFromRules(rules, context), [
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
    repo: { owner: 'owner', repo: 'repo' },
    payload: {} as WebhookEvent,
    ref: 'refs/heads/main',
  }
  assert.deepStrictEqual(await findEnvironmentsFromRules(rules, context), [
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
    repo: { owner: 'owner', repo: 'repo' },
    payload: {} as WebhookEvent,
    ref: 'refs/tags/v1.0.0',
  }
  assert.strictEqual(await findEnvironmentsFromRules(rules, context), undefined)
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
      assert.ok(await matchEnvironment(environment))
    })
    it('returns false if the file does not exist', async () => {
      const environment = {
        outputs: {
          namespace: 'pr-2',
        },
        'if-file-exists': 'tests/fixtures/not-found',
      }
      assert.ok(!(await matchEnvironment(environment)))
    })
  })
})
