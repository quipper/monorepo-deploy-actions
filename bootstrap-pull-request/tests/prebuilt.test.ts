import * as os from 'os'
import * as path from 'path'
import { promises as fs } from 'fs'
import { Service, syncServicesFromPrebuilt } from '../src/prebuilt.js'

const readContent = async (filename: string) => await fs.readFile(filename, 'utf-8')

const createEmptyDirectory = async () => await fs.mkdtemp(path.join(os.tmpdir(), 'bootstrap-pull-request-'))

describe('syncServicesFromPrebuilt', () => {
  it('creates the manifests if empty', async () => {
    const namespaceDirectory = await createEmptyDirectory()

    const services = await syncServicesFromPrebuilt({
      currentHeadSha: 'current-sha',
      overlay: 'pr',
      namespace: 'pr-123',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      prebuiltBranch: 'prebuilt/source-repository/pr',
      prebuiltDirectory: `${__dirname}/fixtures/prebuilt`,
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    expect(services).toStrictEqual<Service[]>([
      {
        service: 'a',
        builtFrom: {
          prebuilt: {
            prebuiltBranch: 'prebuilt/source-repository/pr',
            builtFrom: { headRef: 'main', headSha: 'main-branch-sha' },
          },
        },
      },
      {
        service: 'b',
        builtFrom: {
          prebuilt: {
            prebuiltBranch: 'prebuilt/source-repository/pr',
            builtFrom: { headRef: 'main', headSha: 'main-branch-sha' },
          },
        },
      },
    ])
    expect(await fs.readdir(`${namespaceDirectory}/applications`)).toStrictEqual(['pr-123--a.yaml', 'pr-123--b.yaml'])
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`)).toBe(applicationA)
    expect(await readContent(`${namespaceDirectory}/services/a/generated.yaml`)).toBe(serviceA)
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--b.yaml`)).toBe(applicationB)
    expect(await readContent(`${namespaceDirectory}/services/b/generated.yaml`)).toBe(serviceB)
  })

  it('overwrites an outdated manifest', async () => {
    const namespaceDirectory = await createEmptyDirectory()
    await fs.mkdir(`${namespaceDirectory}/applications`)
    await fs.mkdir(`${namespaceDirectory}/services/a`, { recursive: true })
    await fs.writeFile(`${namespaceDirectory}/applications/pr-123--a.yaml`, applicationPushedOnOutdatedCommit)
    await fs.writeFile(`${namespaceDirectory}/services/a/generated.yaml`, 'this-should-be-overwritten')

    const services = await syncServicesFromPrebuilt({
      currentHeadSha: 'current-sha',
      overlay: 'pr',
      namespace: 'pr-123',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      prebuiltBranch: 'prebuilt/source-repository/pr',
      prebuiltDirectory: `${__dirname}/fixtures/prebuilt`,
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    expect(services).toStrictEqual<Service[]>([
      {
        service: 'a',
        builtFrom: {
          prebuilt: {
            prebuiltBranch: 'prebuilt/source-repository/pr',
            builtFrom: { headRef: 'main', headSha: 'main-branch-sha' },
          },
        },
      },
      {
        service: 'b',
        builtFrom: {
          prebuilt: {
            prebuiltBranch: 'prebuilt/source-repository/pr',
            builtFrom: { headRef: 'main', headSha: 'main-branch-sha' },
          },
        },
      },
    ])
    expect(await fs.readdir(`${namespaceDirectory}/applications`)).toStrictEqual(['pr-123--a.yaml', 'pr-123--b.yaml'])
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`)).toBe(applicationA)
    expect(await readContent(`${namespaceDirectory}/services/a/generated.yaml`)).toBe(serviceA)
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--b.yaml`)).toBe(applicationB)
    expect(await readContent(`${namespaceDirectory}/services/b/generated.yaml`)).toBe(serviceB)
  })

  it('preserves a service if it was pushed by git-push-action on the current commit', async () => {
    const namespaceDirectory = await createEmptyDirectory()
    await fs.mkdir(`${namespaceDirectory}/applications`)
    await fs.mkdir(`${namespaceDirectory}/services/a`, { recursive: true })
    await fs.writeFile(`${namespaceDirectory}/applications/pr-123--a.yaml`, applicationPushedOnCurrentCommit)
    await fs.writeFile(`${namespaceDirectory}/services/a/generated.yaml`, 'this-should-be-kept')

    const services = await syncServicesFromPrebuilt({
      currentHeadSha: 'current-sha',
      overlay: 'pr',
      namespace: 'pr-123',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      prebuiltBranch: 'prebuilt/source-repository/pr',
      prebuiltDirectory: `${__dirname}/fixtures/prebuilt`,
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    expect(services).toStrictEqual<Service[]>([
      { service: 'a', builtFrom: { pullRequest: { headRef: 'topic-branch', headSha: 'current-sha' } } },
      {
        service: 'b',
        builtFrom: {
          prebuilt: {
            prebuiltBranch: 'prebuilt/source-repository/pr',
            builtFrom: { headRef: 'main', headSha: 'main-branch-sha' },
          },
        },
      },
    ])
    expect(await fs.readdir(`${namespaceDirectory}/applications`)).toStrictEqual(['pr-123--a.yaml', 'pr-123--b.yaml'])
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`)).toBe(
      applicationPushedOnCurrentCommit,
    )
    expect(await readContent(`${namespaceDirectory}/services/a/generated.yaml`)).toBe('this-should-be-kept')
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--b.yaml`)).toBe(applicationB)
    expect(await readContent(`${namespaceDirectory}/services/b/generated.yaml`)).toBe(serviceB)
  })

  it('deletes a service which does not exist in the prebuilt branch', async () => {
    const namespaceDirectory = await createEmptyDirectory()
    await fs.mkdir(`${namespaceDirectory}/applications`)
    await fs.writeFile(`${namespaceDirectory}/applications/pr-123--outdated.yaml`, applicationPushedOnOutdatedCommit)

    const services = await syncServicesFromPrebuilt({
      currentHeadSha: 'current-sha',
      overlay: 'pr',
      namespace: 'pr-123',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      prebuiltBranch: 'prebuilt/source-repository/pr',
      prebuiltDirectory: `${__dirname}/fixtures/prebuilt`,
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    expect(services).toStrictEqual<Service[]>([
      {
        service: 'a',
        builtFrom: {
          prebuilt: {
            prebuiltBranch: 'prebuilt/source-repository/pr',
            builtFrom: { headRef: 'main', headSha: 'main-branch-sha' },
          },
        },
      },
      {
        service: 'b',
        builtFrom: {
          prebuilt: {
            prebuiltBranch: 'prebuilt/source-repository/pr',
            builtFrom: { headRef: 'main', headSha: 'main-branch-sha' },
          },
        },
      },
    ])
    expect(await fs.readdir(`${namespaceDirectory}/applications`, { recursive: true })).toStrictEqual([
      'pr-123--a.yaml',
      'pr-123--b.yaml',
      // pr-123--outdated.yaml should not exist
    ])
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`)).toBe(applicationA)
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--b.yaml`)).toBe(applicationB)
  })

  it('preserves a service if it was pushed by old implementation of git-push-action', async () => {
    const namespaceDirectory = await createEmptyDirectory()
    await fs.mkdir(`${namespaceDirectory}/applications`)
    await fs.mkdir(`${namespaceDirectory}/services/a`, { recursive: true })
    await fs.writeFile(`${namespaceDirectory}/applications/pr-123--a.yaml`, applicationPushedWithoutSha)
    await fs.writeFile(`${namespaceDirectory}/services/a/generated.yaml`, 'this-should-be-kept')

    const services = await syncServicesFromPrebuilt({
      currentHeadSha: 'current-sha',
      overlay: 'pr',
      namespace: 'pr-123',
      sourceRepositoryName: 'source-repository',
      destinationRepository: 'octocat/destination-repository',
      prebuiltBranch: 'prebuilt/source-repository/pr',
      prebuiltDirectory: `${__dirname}/fixtures/prebuilt`,
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    expect(services).toStrictEqual<Service[]>([
      { service: 'a', builtFrom: { pullRequest: { headRef: undefined, headSha: undefined } } },
      {
        service: 'b',
        builtFrom: {
          prebuilt: {
            prebuiltBranch: 'prebuilt/source-repository/pr',
            builtFrom: { headRef: 'main', headSha: 'main-branch-sha' },
          },
        },
      },
    ])
    expect(await fs.readdir(`${namespaceDirectory}/applications`)).toStrictEqual(['pr-123--a.yaml', 'pr-123--b.yaml'])
    expect(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`)).toBe(applicationPushedWithoutSha)
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
    github.head-ref: main
    github.head-sha: main-branch-sha
    built-from-prebuilt-branch: prebuilt/source-repository/pr
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

const applicationPushedOnCurrentCommit = `\
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: pr-123--a
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
  annotations:
    github.action: git-push-service
    github.head-ref: topic-branch
    github.head-sha: current-sha
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

// For the backward compatibility.
const applicationPushedWithoutSha = `\
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: pr-123--a
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
  annotations:
    github.action: git-push-service
    github.sha: this-annotation-was-used-in-the-old-implementation
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

const applicationPushedOnOutdatedCommit = `\
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: pr-123--a
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
  annotations:
    github.action: git-push-service
    github.head-ref: topic-branch
    github.head-sha: outdated-sha
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
    github.head-ref: main
    github.head-sha: main-branch-sha
    built-from-prebuilt-branch: prebuilt/source-repository/pr
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
