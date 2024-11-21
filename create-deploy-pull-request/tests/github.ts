import * as github from '@actions/github'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

export const server = setupServer(
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

export const getOctokit = () => github.getOctokit('GITHUB_TOKEN', { request: { fetch } })
