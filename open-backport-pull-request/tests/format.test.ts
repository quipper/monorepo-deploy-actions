import assert from 'node:assert'
import { describe, it } from 'node:test'
import { getCommitMessage, getPullRequestBody, getPullRequestTitle } from '../src/format.ts'
import type { Context } from '../src/github.ts'

const context: Context = {
  actor: 'octocat',
  repo: {
    owner: 'owner',
    repo: 'repo',
  },
  runId: '1',
}

describe('getCommitMessage', () => {
  it('should return the commit message', () => {
    const params = {
      headBranch: 'production',
      baseBranch: 'main',
      skipCI: false,
    }
    assert.strictEqual(
      getCommitMessage(params, context),
      `Backport from production into main

https://github.com/owner/repo/actions/runs/1`,
    )
  })

  it('should return the commit message with skip ci', () => {
    const params = {
      headBranch: 'production',
      baseBranch: 'main',
      skipCI: true,
    }
    assert.strictEqual(
      getCommitMessage(params, context),
      `Backport from production into main [skip ci]

https://github.com/owner/repo/actions/runs/1`,
    )
  })
})

describe('getPullRequestTitle', () => {
  it('should return the pull request title', () => {
    const params = {
      headBranch: 'production',
      baseBranch: 'main',
      pullRequestTitle: 'Backport from HEAD_BRANCH into BASE_BRANCH',
      pullRequestBody: '',
    }
    assert.strictEqual(getPullRequestTitle(params), 'Backport from production into main')
  })
})

describe('getPullRequestBody', () => {
  it('should return the pull request body', () => {
    const params = {
      headBranch: 'production',
      baseBranch: 'main',
      pullRequestTitle: '',
      pullRequestBody: 'This is a backport pull request from HEAD_BRANCH into BASE_BRANCH',
    }
    assert.strictEqual(
      getPullRequestBody(params, context),
      `This is a backport pull request from production into main

----
https://github.com/owner/repo/actions/runs/1`,
    )
  })
})
