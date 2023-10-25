import * as os from 'os'
import * as path from 'path'
import { promises as fs } from 'fs'
import { syncServicesFromPrebuilt } from '../src/prebuilt'

const readContent = async (filename: string) => (await fs.readFile(filename)).toString()

const createEmptyDirectory = async () => await fs.mkdtemp(path.join(os.tmpdir(), 'bootstrap-pull-request-'))

describe('syncServicesFromPrebuilt', () => {
  it('should create the manifests if empty', async () => {
    const namespaceDirectory = await createEmptyDirectory()

    await syncServicesFromPrebuilt({
      overlay: 'pr',
      namespace: 'pr-123',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      prebuiltDirectory: `${__dirname}/fixtures/prebuilt`,
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    expect(await fs.readdir(`${namespaceDirectory}/applications`)).toStrictEqual(['pr-123--a.yaml', 'pr-123--b.yaml'])
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`)).toBe(applicationA)
    expect(await readContent(`${namespaceDirectory}/services/a/generated.yaml`)).toBe(serviceA)
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--b.yaml`)).toBe(applicationB)
    expect(await readContent(`${namespaceDirectory}/services/b/generated.yaml`)).toBe(serviceB)
  })

  it('should overwrite a manifest if it was pushed by this action', async () => {
    const namespaceDirectory = await createEmptyDirectory()
    await fs.mkdir(`${namespaceDirectory}/applications`)
    await fs.mkdir(`${namespaceDirectory}/services/a`, { recursive: true })
    await fs.writeFile(`${namespaceDirectory}/applications/pr-123--a.yaml`, applicationA)
    await fs.writeFile(`${namespaceDirectory}/services/a/generated.yaml`, 'this-should-be-overwritten')

    await syncServicesFromPrebuilt({
      overlay: 'pr',
      namespace: 'pr-123',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      prebuiltDirectory: `${__dirname}/fixtures/prebuilt`,
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    expect(await fs.readdir(`${namespaceDirectory}/applications`)).toStrictEqual(['pr-123--a.yaml', 'pr-123--b.yaml'])
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`)).toBe(applicationA)
    expect(await readContent(`${namespaceDirectory}/services/a/generated.yaml`)).toBe(serviceA)
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--b.yaml`)).toBe(applicationB)
    expect(await readContent(`${namespaceDirectory}/services/b/generated.yaml`)).toBe(serviceB)
  })

  it('should not overwrite a manifest if it was pushed by git-push-service action', async () => {
    const namespaceDirectory = await createEmptyDirectory()
    await fs.mkdir(`${namespaceDirectory}/applications`)
    await fs.mkdir(`${namespaceDirectory}/services/a`, { recursive: true })
    await fs.writeFile(`${namespaceDirectory}/applications/pr-123--a.yaml`, applicationAPushedByGitPushServiceAction)
    await fs.writeFile(`${namespaceDirectory}/services/a/generated.yaml`, 'this-should-be-kept')

    await syncServicesFromPrebuilt({
      overlay: 'pr',
      namespace: 'pr-123',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      prebuiltDirectory: `${__dirname}/fixtures/prebuilt`,
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    expect(await fs.readdir(`${namespaceDirectory}/applications`)).toStrictEqual(['pr-123--a.yaml', 'pr-123--b.yaml'])
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`)).toBe(
      applicationAPushedByGitPushServiceAction,
    )
    expect(await readContent(`${namespaceDirectory}/services/a/generated.yaml`)).toBe('this-should-be-kept')
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--b.yaml`)).toBe(applicationB)
    expect(await readContent(`${namespaceDirectory}/services/b/generated.yaml`)).toBe(serviceB)
  })

  it('should delete an outdated application manifest', async () => {
    const namespaceDirectory = await createEmptyDirectory()
    await fs.mkdir(`${namespaceDirectory}/applications`)
    await fs.writeFile(`${namespaceDirectory}/applications/pr-123--outdated.yaml`, applicationA)

    await syncServicesFromPrebuilt({
      overlay: 'pr',
      namespace: 'pr-123',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      prebuiltDirectory: `${__dirname}/fixtures/prebuilt`,
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    expect(await fs.readdir(`${namespaceDirectory}/applications`, { recursive: true })).toStrictEqual([
      'pr-123--a.yaml',
      'pr-123--b.yaml',
      // pr-123--outdated.yaml should not exist
    ])
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`)).toBe(applicationA)
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--b.yaml`)).toBe(applicationB)
  })

  it('should not delete an application manifest if it was pushed by git-push-service action', async () => {
    const namespaceDirectory = await createEmptyDirectory()
    await fs.mkdir(`${namespaceDirectory}/applications`)
    await fs.writeFile(
      `${namespaceDirectory}/applications/pr-123--outdated.yaml`,
      applicationAPushedByGitPushServiceAction,
    )

    await syncServicesFromPrebuilt({
      overlay: 'pr',
      namespace: 'pr-123',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      prebuiltDirectory: `${__dirname}/fixtures/prebuilt`,
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    expect(await fs.readdir(`${namespaceDirectory}/applications`)).toStrictEqual([
      'pr-123--a.yaml',
      'pr-123--b.yaml',
      'pr-123--outdated.yaml', // should exist
    ])
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`)).toBe(applicationA)
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--b.yaml`)).toBe(applicationB)
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--outdated.yaml`)).toBe(
      applicationAPushedByGitPushServiceAction,
    )
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
    github.action: bootstrap-pull-request
spec:
  project: source-repository
  source:
    repoURL: https://github.com/octocat/destination-repository.git
    targetRevision: ns/source-repository/pr/pr-123
    path: services/a
  destination:
    server: https://kubernetes.default.svc
    namespace: pr-123
  syncPolicy:
    automated:
      prune: true
`

const applicationAPushedByGitPushServiceAction = `\
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: pr-123--a
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
  annotations:
    github.action: git-push-service
spec:
  project: source-repository
  source:
    repoURL: https://github.com/octocat/destination-repository.git
    targetRevision: ns/source-repository/pr/pr-123
    path: services/a
  destination:
    server: https://kubernetes.default.svc
    namespace: pr-123
  syncPolicy:
    automated:
      prune: true
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
    github.action: bootstrap-pull-request
spec:
  project: source-repository
  source:
    repoURL: https://github.com/octocat/destination-repository.git
    targetRevision: ns/source-repository/pr/pr-123
    path: services/b
  destination:
    server: https://kubernetes.default.svc
    namespace: pr-123
  syncPolicy:
    automated:
      prune: true
`

const serviceA = `\
# fixture
name: a
namespace: pr-123
`

const serviceB = `\
# fixture
name: b
namespace: pr-123
`
