import * as os from 'os'
import * as path from 'path'
import { promises as fs } from 'fs'
import { listApplicationFiles, readApplication } from '../src/application.js'

const createEmptyDirectory = async () => await fs.mkdtemp(path.join(os.tmpdir(), 'bootstrap-pull-request-'))

describe('listApplicationFiles', () => {
  it('lists up the application files, not other files', async () => {
    const namespaceDirectory = await createEmptyDirectory()
    await fs.mkdir(`${namespaceDirectory}/applications`)
    const fileA = `${namespaceDirectory}/applications/pr-123--a.yaml`
    await fs.writeFile(fileA, applicationA)
    const fileB = `${namespaceDirectory}/applications/pr-123--b.yaml`
    await fs.writeFile(fileB, applicationB)
    await fs.writeFile(`${namespaceDirectory}/applications/other.yaml`, '')

    const result = await listApplicationFiles(namespaceDirectory)

    // sort the result to make the test deterministic

    expect(result.sort()).toStrictEqual([fileA, fileB])
  })
})

describe('readApplication', () => {
  it('', async () => {
    const namespaceDirectory = await createEmptyDirectory()
    await fs.mkdir(`${namespaceDirectory}/applications`)
    await fs.writeFile(`${namespaceDirectory}/applications/pr-123--a.yaml`, applicationA)
    await fs.writeFile(`${namespaceDirectory}/applications/other.yaml`, '')

    const result = await readApplication(`${namespaceDirectory}/applications/pr-123--a.yaml`)
    expect(result).toStrictEqual({
      service: 'a',
      action: 'git-push-service',
      headRef: 'current-ref-A',
      headSha: 'current-sha-A',
    })
  })
})

const applicationA = `\
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: pr-123--a
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
  annotations:
    github.action: git-push-service
    github.head-ref: current-ref-A
    github.head-sha: current-sha-A
spec: {}
`

const applicationB = `\
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: pr-123--b
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
  annotations:
    github.action: git-push-service
    github.head-ref: current-ref-B
    github.head-sha: current-sha-B
spec: {}
`
