import { Context } from '../src/github.js'
import { getCommitMessage, getPullRequestBody, getPullRequestTitle } from '../src/format.js'
import { describe, it, expect } from 'vitest'

const context: Context = {
  actor: 'octocat',
  repo: {
    owner: 'owner',
    repo: 'repo',
  },
  runId: 1,
}

describe('getCommitMessage', () => {
  it('should return the commit message', () => {
    const params = {
      headBranch: 'production',
      baseBranch: 'main',
      skipCI: false,
    }
    expect(getCommitMessage(params, context)).toEqual(`Backport from production into main

https://github.com/owner/repo/actions/runs/1`)
  })

  it('should return the commit message with skip ci', () => {
    const params = {
      headBranch: 'production',
      baseBranch: 'main',
      skipCI: true,
    }
    expect(getCommitMessage(params, context)).toEqual(`Backport from production into main [skip ci]

https://github.com/owner/repo/actions/runs/1`)
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
    expect(getPullRequestTitle(params)).toEqual('Backport from production into main')
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
    expect(getPullRequestBody(params, context)).toEqual(`This is a backport pull request from production into main

----
https://github.com/owner/repo/actions/runs/1`)
  })
})
