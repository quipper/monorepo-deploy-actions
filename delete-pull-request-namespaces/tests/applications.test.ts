import * as git from '../src/git.js'
import * as os from 'os'
import * as path from 'path'
import { deleteNamespaceApplicationsWithRetry } from '../src/applications.js'
import { promises as fs } from 'fs'

jest.mock('../src/git')

const listFilenames = async (dir: string) =>
  (await fs.readdir(dir, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name)

it('should do nothing if no manifest', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'delete-namespace-applications-'))
  await fs.mkdir(`${cwd}/source-repository/pr`, { recursive: true })

  jest.mocked(git.checkout).mockResolvedValueOnce(cwd)

  const deletedPullRequestNumbers = await deleteNamespaceApplicationsWithRetry({
    overlay: 'pr',
    namespacePrefix: 'pr-',
    sourceRepositoryName: 'source-repository',
    destinationRepository: 'destination-repository',
    destinationBranch: 'main',
    destinationRepositoryToken: 'token',
    excludePullRequestNumbers: [],
    excludeUpdatedWithinMinutes: 0,
    commitMessage: 'commitMessage',
    dryRun: false,
  })

  expect(deletedPullRequestNumbers).toEqual([])
  expect(await listFilenames(`${cwd}/source-repository/pr`)).toEqual([])
})

it('should delete all namespaces', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'delete-namespace-applications-'))
  await fs.mkdir(`${cwd}/source-repository/pr`, { recursive: true })
  await fs.writeFile(`${cwd}/source-repository/pr/pr-100.yaml`, 'dummy')
  await fs.writeFile(`${cwd}/source-repository/pr/pr-200.yaml`, 'dummy')

  jest.mocked(git.checkout).mockResolvedValueOnce(cwd)
  jest.mocked(git.getLastCommitDate).mockResolvedValue(new Date())

  const deletedPullRequestNumbers = await deleteNamespaceApplicationsWithRetry({
    overlay: 'pr',
    namespacePrefix: 'pr-',
    sourceRepositoryName: 'source-repository',
    destinationRepository: 'destination-repository',
    destinationBranch: 'main',
    destinationRepositoryToken: 'token',
    excludePullRequestNumbers: [],
    excludeUpdatedWithinMinutes: 0,
    commitMessage: 'commitMessage',
    dryRun: false,
  })

  expect(deletedPullRequestNumbers).toEqual([100, 200])
  expect(await listFilenames(`${cwd}/source-repository/pr`)).toEqual([])
})

it('should exclude given namespaces', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'delete-namespace-applications-'))
  await fs.mkdir(`${cwd}/source-repository/pr`, { recursive: true })
  await fs.writeFile(`${cwd}/source-repository/pr/pr-100.yaml`, 'dummy')
  await fs.writeFile(`${cwd}/source-repository/pr/pr-200.yaml`, 'dummy')

  jest.mocked(git.checkout).mockResolvedValueOnce(cwd)
  jest.mocked(git.getLastCommitDate).mockResolvedValue(dateMinutesAgo(0))

  const deletedPullRequestNumbers = await deleteNamespaceApplicationsWithRetry({
    overlay: 'pr',
    namespacePrefix: 'pr-',
    sourceRepositoryName: 'source-repository',
    destinationRepository: 'destination-repository',
    destinationBranch: 'main',
    destinationRepositoryToken: 'token',
    excludePullRequestNumbers: [100],
    excludeUpdatedWithinMinutes: 0,
    commitMessage: 'commitMessage',
    dryRun: false,
  })

  expect(deletedPullRequestNumbers).toEqual([200])
  expect(await listFilenames(`${cwd}/source-repository/pr`)).toEqual(['pr-100.yaml'])
})

it('should exclude recently updated namespaces', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'delete-namespace-applications-'))
  await fs.mkdir(`${cwd}/source-repository/pr`, { recursive: true })
  await fs.writeFile(`${cwd}/source-repository/pr/pr-100.yaml`, 'dummy')
  await fs.writeFile(`${cwd}/source-repository/pr/pr-200.yaml`, 'dummy')

  jest.mocked(git.checkout).mockResolvedValueOnce(cwd)
  jest.mocked(git.getLastCommitDate).mockResolvedValueOnce(dateMinutesAgo(60)) // pr-100
  jest.mocked(git.getLastCommitDate).mockResolvedValueOnce(dateMinutesAgo(10)) // pr-200

  const deletedPullRequestNumbers = await deleteNamespaceApplicationsWithRetry({
    overlay: 'pr',
    namespacePrefix: 'pr-',
    sourceRepositoryName: 'source-repository',
    destinationRepository: 'destination-repository',
    destinationBranch: 'main',
    destinationRepositoryToken: 'token',
    excludePullRequestNumbers: [],
    excludeUpdatedWithinMinutes: 15,
    commitMessage: 'commitMessage',
    dryRun: false,
  })

  expect(deletedPullRequestNumbers).toEqual([100])
  expect(await listFilenames(`${cwd}/source-repository/pr`)).toEqual(['pr-200.yaml'])
})

const dateMinutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000)
