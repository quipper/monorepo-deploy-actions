import { run } from '../src/run.js'
import { getOctokit, server } from './github.js'
import { http, HttpResponse } from 'msw'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

it('should create base branch if not exist', async () => {
  server.use(
    http.get('https://api.github.com/repos/test-owner/test-repo-1/branches/release', () =>
      HttpResponse.json({
        commit: {
          sha: 'commit-sha-1-release',
        },
      }),
    ),
    http.get(
      'https://api.github.com/repos/test-owner/test-repo-1/branches/production',
      () => new HttpResponse(null, { status: 404 }),
    ),
    http.post(
      'https://api.github.com/repos/test-owner/test-repo-1/git/refs',
      () => new HttpResponse(null, { status: 201 }),
    ),
  )
  const outputs = await run(
    {
      head: 'release',
      base: 'production',
      title: 'Deploy service to production',
      body: 'Hello',
      actor: 'octocat',
      labels: [],
      draft: true,
      owner: 'test-owner',
      repo: 'test-repo-1',
      now: () => new Date(Date.UTC(2023, 8, 7, 6, 1, 2, 0)),
      timeZone: 'Asia/Tokyo',
    },
    getOctokit(),
  )
  expect(outputs.pullRequestUrl).toBeUndefined()
})

it('should create pull request if base branch exists', async () => {
  server.use(
    http.get('https://api.github.com/repos/test-owner/test-repo-2/branches/release', () =>
      HttpResponse.json({
        commit: {
          sha: 'commit-sha-2-release',
        },
      }),
    ),
    http.get('https://api.github.com/repos/test-owner/test-repo-2/branches/production', () =>
      HttpResponse.json({
        // Omit an example response
      }),
    ),
    http.get('https://api.github.com/repos/test-owner/test-repo-2/pulls', ({ request }) => {
      const url = new URL(request.url)
      expect(url.searchParams.get('base')).toBe('production')
      expect(url.searchParams.get('head')).toBe('test-owner:release')
      return HttpResponse.json([])
    }),
    http.post('https://api.github.com/repos/test-owner/test-repo-2/pulls', () =>
      HttpResponse.json({
        html_url: 'https://github.com/test-owner/test-repo-2/pulls/100',
      }),
    ),
    http.post('https://api.github.com/repos/test-owner/test-repo-2/pulls//requested_reviewers', () =>
      HttpResponse.json({
        // Omit an example response
      }),
    ),
    http.post('https://api.github.com/repos/test-owner/test-repo-2/issues//assignees', () =>
      HttpResponse.json({
        // Omit an example response
      }),
    ),
  )
  const outputs = await run(
    {
      head: 'release',
      base: 'production',
      title: 'Deploy service to production',
      body: 'Hello',
      actor: 'octocat',
      labels: [],
      draft: true,
      owner: 'test-owner',
      repo: 'test-repo-2',
      now: () => new Date(Date.UTC(2023, 8, 7, 6, 1, 2, 0)),
      timeZone: 'Asia/Tokyo', // UTC+9
    },
    getOctokit(),
  )
  expect(outputs.pullRequestUrl).toBe('https://github.com/test-owner/test-repo-2/pulls/100')
})
