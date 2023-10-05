import * as github from '@actions/github'
import { deleteNamespaceBranches } from '../src/branches'

const octokitMock = {
  paginate: <T>(f: (...args: unknown[]) => T, ...args: unknown[]) => f(args),
  rest: {
    git: {
      listMatchingRefs: jest.fn(),
      deleteRef: jest.fn(),
    },
  },
}
jest.mock('@actions/github', () => ({ getOctokit: jest.fn(() => octokitMock) }))

describe('deleteNamespaceBranches', () => {
  it('should do nothing if no branch', async () => {
    octokitMock.rest.git.listMatchingRefs.mockResolvedValueOnce([])

    await deleteNamespaceBranches({
      overlay: 'pr',
      namespacePrefix: 'pr-',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      destinationRepositoryToken: 'destination-token',
      openPullRequestNumbers: [],
      deployedPullRequestNumbers: [],
      dryRun: false,
    })
    expect(github.getOctokit).toHaveBeenCalledWith('destination-token')
    expect(octokitMock.rest.git.deleteRef).not.toHaveBeenCalled()
  })

  it('should delete all branches if no open', async () => {
    octokitMock.rest.git.listMatchingRefs.mockResolvedValueOnce([
      { ref: 'refs/heads/ns/source-repository/pr/pr-100' },
      { ref: 'refs/heads/ns/source-repository/pr/pr-200' },
    ])

    await deleteNamespaceBranches({
      overlay: 'pr',
      namespacePrefix: 'pr-',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      destinationRepositoryToken: 'destination-token',
      openPullRequestNumbers: [],
      deployedPullRequestNumbers: [],
      dryRun: false,
    })
    expect(octokitMock.rest.git.deleteRef).toHaveBeenCalledWith({
      owner: 'octocat',
      repo: 'destination-repository',
      ref: 'heads/ns/source-repository/pr/pr-100',
    })
    expect(octokitMock.rest.git.deleteRef).toHaveBeenCalledWith({
      owner: 'octocat',
      repo: 'destination-repository',
      ref: 'heads/ns/source-repository/pr/pr-200',
    })
  })

  it('should exclude open pull requests', async () => {
    octokitMock.rest.git.listMatchingRefs.mockResolvedValueOnce([
      { ref: 'refs/heads/ns/source-repository/pr/pr-100' },
      { ref: 'refs/heads/ns/source-repository/pr/pr-200' },
    ])

    await deleteNamespaceBranches({
      overlay: 'pr',
      namespacePrefix: 'pr-',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      destinationRepositoryToken: 'destination-token',
      openPullRequestNumbers: [200],
      deployedPullRequestNumbers: [],
      dryRun: false,
    })
    expect(octokitMock.rest.git.deleteRef).toHaveBeenCalledWith({
      owner: 'octocat',
      repo: 'destination-repository',
      ref: 'heads/ns/source-repository/pr/pr-100',
    })
  })

  it('should exclude deployed pull requests', async () => {
    octokitMock.rest.git.listMatchingRefs.mockResolvedValueOnce([
      { ref: 'refs/heads/ns/source-repository/pr/pr-100' },
      { ref: 'refs/heads/ns/source-repository/pr/pr-200' },
    ])

    await deleteNamespaceBranches({
      overlay: 'pr',
      namespacePrefix: 'pr-',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      destinationRepositoryToken: 'destination-token',
      openPullRequestNumbers: [],
      deployedPullRequestNumbers: [200],
      dryRun: false,
    })
    expect(octokitMock.rest.git.deleteRef).toHaveBeenCalledWith({
      owner: 'octocat',
      repo: 'destination-repository',
      ref: 'heads/ns/source-repository/pr/pr-100',
    })
  })

  it('should do nothing if all pull requests are open', async () => {
    octokitMock.rest.git.listMatchingRefs.mockResolvedValueOnce([
      { ref: 'refs/heads/ns/source-repository/pr/pr-100' },
      { ref: 'refs/heads/ns/source-repository/pr/pr-200' },
    ])

    await deleteNamespaceBranches({
      overlay: 'pr',
      namespacePrefix: 'pr-',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      destinationRepositoryToken: 'destination-token',
      openPullRequestNumbers: [],
      deployedPullRequestNumbers: [100, 200, 300],
      dryRun: false,
    })
    expect(octokitMock.rest.git.deleteRef).not.toHaveBeenCalled()
  })

  it('should do nothing if all pull requests are still deployed', async () => {
    octokitMock.rest.git.listMatchingRefs.mockResolvedValueOnce([
      { ref: 'refs/heads/ns/source-repository/pr/pr-100' },
      { ref: 'refs/heads/ns/source-repository/pr/pr-200' },
    ])

    await deleteNamespaceBranches({
      overlay: 'pr',
      namespacePrefix: 'pr-',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      destinationRepositoryToken: 'destination-token',
      openPullRequestNumbers: [100, 200, 300],
      deployedPullRequestNumbers: [],
      dryRun: false,
    })
    expect(octokitMock.rest.git.deleteRef).not.toHaveBeenCalled()
  })
})
