import { getCommitMessage } from '../src/run'

describe('getCommitMessage', () => {
  it('should return the commit message', () => {
    const params = {
      headBranch: 'production',
      baseBranch: 'main',
      skipCI: false,
      context: {
        actor: 'octocat',
        repo: {
          owner: 'owner',
          repo: 'repo',
        },
        runId: 1,
      },
    }
    expect(getCommitMessage(params)).toEqual(`Backport from production into main

Created by GitHub Actions
https://github.com/owner/repo/actions/runs/1`)
  })

  it('should return the commit message with skip ci', () => {
    const params = {
      headBranch: 'production',
      baseBranch: 'main',
      skipCI: true,
      context: {
        actor: 'octocat',
        repo: {
          owner: 'owner',
          repo: 'repo',
        },
        runId: 1,
      },
    }
    expect(getCommitMessage(params)).toEqual(`Backport from production into main [skip ci]

Created by GitHub Actions
https://github.com/owner/repo/actions/runs/1`)
  })
})
