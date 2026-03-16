import { HttpResponse, http } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { isExpired, run } from '../src/run.js'
import { getOctokit, server } from './github.js'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('run', () => {
  it('should not update the branch if not expired', async () => {
    let updateBranchCalled = false
    server.use(
      http.get('https://api.github.com/repos/test-owner/test-repo/git/commits/test-sha', () =>
        HttpResponse.json({
          committer: {
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          },
        }),
      ),
      http.put('https://api.github.com/repos/test-owner/test-repo/pulls/1/update-branch', () => {
        updateBranchCalled = true
        return HttpResponse.json({ message: 'Scheduled task', url: 'https://github.com/test-owner/test-repo/pulls/1' })
      }),
    )
    await run({ expirationDays: 7 }, getOctokit(), {
      repo: { owner: 'test-owner', repo: 'test-repo' },
      pullRequestNumber: 1,
      pullRequestHeadSHA: 'test-sha',
    })
    expect(updateBranchCalled).toBe(false)
  })

  it('should update the branch if expired', async () => {
    let updateBranchCalled = false
    server.use(
      http.get('https://api.github.com/repos/test-owner/test-repo/git/commits/test-sha', () =>
        HttpResponse.json({
          committer: {
            date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          },
        }),
      ),
      http.put('https://api.github.com/repos/test-owner/test-repo/pulls/1/update-branch', () => {
        updateBranchCalled = true
        return HttpResponse.json({ message: 'Scheduled task', url: 'https://github.com/test-owner/test-repo/pulls/1' })
      }),
    )
    await run({ expirationDays: 7 }, getOctokit(), {
      repo: { owner: 'test-owner', repo: 'test-repo' },
      pullRequestNumber: 1,
      pullRequestHeadSHA: 'test-sha',
    })
    expect(updateBranchCalled).toBe(true)
  })
})

describe('isExpired', () => {
  const now = () => Date.parse('2021-02-03T04:05:06Z')

  it('should return true if expired', () => {
    const headCommitDate = '2021-01-31T00:00:00Z'
    const expirationDays = 3
    expect(isExpired(now, headCommitDate, expirationDays)).toBeTruthy()
  })

  it('should return false if not expired', () => {
    const headCommitDate = '2021-02-02T00:00:00Z'
    const expirationDays = 3
    expect(isExpired(now, headCommitDate, expirationDays)).toBeFalsy()
  })
})
