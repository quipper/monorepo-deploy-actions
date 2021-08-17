import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import { deletePullRequests } from '../src/delete'

test('do nothing when no manifest', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-delete-namespace-application-'))
  const deletedPullRequestNumbers = await deletePullRequests({
    directory: workspace,
    namespacePrefix: 'pr-',
    retain: [],
  })
  expect(deletedPullRequestNumbers).toEqual([])
  expect(await listFiles(workspace)).toEqual([])
})

test('delete all', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-delete-namespace-application-'))
  await fs.writeFile(`${workspace}/pr-100.yaml`, 'dummy')
  await fs.writeFile(`${workspace}/pr-200.yaml`, 'dummy')
  const deletedPullRequestNumbers = await deletePullRequests({
    directory: workspace,
    namespacePrefix: 'pr-',
    retain: [],
  })
  expect(deletedPullRequestNumbers).toEqual(['100', '200'])
  expect(await listFiles(workspace)).toEqual([])
})

test('retain some manifest', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-delete-namespace-application-'))
  await fs.writeFile(`${workspace}/pr-100.yaml`, 'dummy')
  await fs.writeFile(`${workspace}/pr-200.yaml`, 'dummy')
  const deletedPullRequestNumbers = await deletePullRequests({
    directory: workspace,
    namespacePrefix: 'pr-',
    retain: ['100'],
  })
  expect(deletedPullRequestNumbers).toEqual(['200'])
  expect(await listFiles(workspace)).toEqual(['pr-100.yaml'])
})

test('retain all manifests', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-delete-namespace-application-'))
  await fs.writeFile(`${workspace}/pr-100.yaml`, 'dummy')
  await fs.writeFile(`${workspace}/pr-200.yaml`, 'dummy')
  const deletedPullRequestNumbers = await deletePullRequests({
    directory: workspace,
    namespacePrefix: 'pr-',
    retain: ['100', '200'],
  })
  expect(deletedPullRequestNumbers).toEqual([])
  expect(await listFiles(workspace)).toEqual(['pr-100.yaml', 'pr-200.yaml'])
})

const listFiles = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries.filter((e) => e.isFile()).map((e) => e.name)
}
