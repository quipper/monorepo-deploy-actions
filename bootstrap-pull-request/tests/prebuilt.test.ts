import * as os from 'os'
import * as path from 'path'
import { promises as fs } from 'fs'
import { copyServicesFromPrebuilt } from '../src/prebuilt'

const readContent = async (filename: string) => (await fs.readFile(filename)).toString()

describe('copyServicesFromPrebuilt', () => {
  it('should create the manifests if empty', async () => {
    const namespaceDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'bootstrap-pull-request-'))

    await copyServicesFromPrebuilt({
      overlay: 'pr',
      namespace: 'pr-123',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      prebuiltDirectory: `${__dirname}/fixtures/prebuilt`,
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    expect(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`)).toBe(applicationA)
    expect(await readContent(`${namespaceDirectory}/services/a/generated.yaml`)).toBe(serviceA)
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--b.yaml`)).toBe(applicationB)
    expect(await readContent(`${namespaceDirectory}/services/b/generated.yaml`)).toBe(serviceB)
  })

  it('should overwrite a manifest if it was pushed by this action', async () => {
    const namespaceDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'bootstrap-pull-request-'))
    await fs.mkdir(`${namespaceDirectory}/applications`)
    await fs.mkdir(`${namespaceDirectory}/services/a`, { recursive: true })
    await fs.writeFile(`${namespaceDirectory}/applications/pr-123--a.yaml`, applicationA)
    await fs.writeFile(`${namespaceDirectory}/services/a/generated.yaml`, 'this-should-be-overwritten')

    await copyServicesFromPrebuilt({
      overlay: 'pr',
      namespace: 'pr-123',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      prebuiltDirectory: `${__dirname}/fixtures/prebuilt`,
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    expect(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`)).toBe(applicationA)
    expect(await readContent(`${namespaceDirectory}/services/a/generated.yaml`)).toBe(serviceA)
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--b.yaml`)).toBe(applicationB)
    expect(await readContent(`${namespaceDirectory}/services/b/generated.yaml`)).toBe(serviceB)
  })

  it('should not overwrite a manifest if it was pushed by git-push-service action', async () => {
    const namespaceDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'bootstrap-pull-request-'))
    await fs.mkdir(`${namespaceDirectory}/applications`)
    await fs.mkdir(`${namespaceDirectory}/services/a`, { recursive: true })
    await fs.writeFile(`${namespaceDirectory}/applications/pr-123--a.yaml`, applicationAPushedByGitPushServiceAction)
    await fs.writeFile(`${namespaceDirectory}/services/a/generated.yaml`, 'this-should-be-kept')

    await copyServicesFromPrebuilt({
      overlay: 'pr',
      namespace: 'pr-123',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      prebuiltDirectory: `${__dirname}/fixtures/prebuilt`,
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    expect(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`)).toBe(
      applicationAPushedByGitPushServiceAction,
    )
    expect(await readContent(`${namespaceDirectory}/services/a/generated.yaml`)).toBe('this-should-be-kept')
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--b.yaml`)).toBe(applicationB)
    expect(await readContent(`${namespaceDirectory}/services/b/generated.yaml`)).toBe(serviceB)
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
