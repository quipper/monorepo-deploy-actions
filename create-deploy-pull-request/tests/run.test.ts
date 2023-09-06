import { run } from '../src/run'
import { RequestError } from '@octokit/request-error'

const octokitMock = {
  rest: {
    repos: {
      getBranch: jest.fn(),
    },
    pulls: {
      list: jest.fn(),
      create: jest.fn(),
      requestReviewers: jest.fn(),
    },
    issues: {
      addAssignees: jest.fn(),
      addLabels: jest.fn(),
    },
    git: {
      createRef: jest.fn(),
      updateRef: jest.fn(),
    },
  },
}

jest.mock('@actions/github', () => ({ getOctokit: () => octokitMock }))

it('should create base branch if not exist', async () => {
  octokitMock.rest.repos.getBranch.mockRejectedValueOnce(
    new RequestError('not found', 404, {
      request: { method: 'GET', url: 'dummy', headers: {} },
      response: { status: 404, url: 'dummy', headers: {}, data: {} },
    }),
  )
  octokitMock.rest.repos.getBranch.mockResolvedValueOnce({
    data: { commit: { sha: 'release-sha' } },
  })

  await run({
    head: 'release',
    base: 'production',
    title: 'Deploy service to production',
    body: 'Hello',
    actor: 'octocat',
    labels: [],
    draft: true,
    owner: 'OWNER',
    repo: 'REPO',
    token: 'GITHUB_TOKEN',
  })

  expect(octokitMock.rest.repos.getBranch).toHaveBeenCalledTimes(2)
  expect(octokitMock.rest.repos.getBranch).toHaveBeenNthCalledWith(1, {
    owner: 'OWNER',
    repo: 'REPO',
    branch: 'production',
  })
  expect(octokitMock.rest.repos.getBranch).toHaveBeenNthCalledWith(2, {
    owner: 'OWNER',
    repo: 'REPO',
    branch: 'release',
  })
  expect(octokitMock.rest.git.createRef).toHaveBeenCalledWith({
    owner: 'OWNER',
    repo: 'REPO',
    ref: 'refs/heads/production',
    sha: 'release-sha',
  })
})

it('should create pull request if base branch exists', async () => {
  octokitMock.rest.repos.getBranch.mockResolvedValueOnce({
    data: { commit: { sha: 'production-exists' } },
  })
  octokitMock.rest.pulls.list.mockResolvedValueOnce({
    data: [],
  })
  octokitMock.rest.pulls.create.mockResolvedValueOnce({
    data: { html_url: 'https://github.com/OWNER/REPO/pulls/1' },
  })

  await run({
    head: 'release',
    base: 'production',
    title: 'Deploy service to production',
    body: 'Hello',
    actor: 'octocat',
    labels: [],
    draft: true,
    owner: 'OWNER',
    repo: 'REPO',
    token: 'GITHUB_TOKEN',
  })

  expect(octokitMock.rest.repos.getBranch).toHaveBeenCalledTimes(1)
  expect(octokitMock.rest.repos.getBranch).toHaveBeenNthCalledWith(1, {
    owner: 'OWNER',
    repo: 'REPO',
    branch: 'production',
  })
  expect(octokitMock.rest.pulls.create).toHaveBeenCalledWith({
    owner: 'OWNER',
    repo: 'REPO',
    head: 'release',
    base: 'production',
    title: 'Deploy service to production',
    body: 'Hello',
    draft: true,
  })
})
