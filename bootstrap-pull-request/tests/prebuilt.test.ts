import assert from 'node:assert'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it } from 'node:test'
import { type Service, syncServicesFromPrebuilt } from '../src/prebuilt.ts'

const readContent = async (filename: string) => await fs.readFile(filename, 'utf-8')

const createEmptyDirectory = async () => await fs.mkdtemp(path.join(os.tmpdir(), 'bootstrap-pull-request-'))

describe('syncServicesFromPrebuilt', () => {
  it('copies the manifests from the prebuilt branch', async () => {
    const namespaceDirectory = await createEmptyDirectory()

    const services = await syncServicesFromPrebuilt({
      applicationContext: {
        overlay: 'pr',
        namespace: 'pr-123',
        project: 'source-repository',
        destinationRepository: 'octocat/destination-repository',
      },
      changedServices: [],
      prebuiltBranch: {
        name: 'prebuilt/source-repository/pr',
        directory: `${import.meta.dirname}/fixtures/prebuilt`,
        aggregateToNamespaceDirectory: false,
      },
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    assert.deepStrictEqual<Service[]>(services, [
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
      {
        service: 'c',
        builtFrom: {
          prebuilt: {
            prebuiltBranch: 'prebuilt/source-repository/pr',
            builtFrom: { headRef: 'main', headSha: 'main-branch-sha' },
          },
        },
      },
    ])
    assert.deepStrictEqual(await fs.readdir(`${namespaceDirectory}/applications`), [
      'pr-123--a.yaml',
      'pr-123--b.yaml',
      'pr-123--c.yaml',
    ])
    assert.strictEqual(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`), applicationA)
    assert.strictEqual(await readContent(`${namespaceDirectory}/applications/pr-123--b.yaml`), applicationB)
    assert.deepStrictEqual(await fs.readdir(`${namespaceDirectory}/services`), ['a', 'b', 'c'])
    assert.strictEqual(await readContent(`${namespaceDirectory}/services/a/generated.yaml`), serviceA)
    assert.strictEqual(await readContent(`${namespaceDirectory}/services/b/generated.yaml`), serviceB)
  })

  it('does not overwrite the changed services', async () => {
    const namespaceDirectory = await createEmptyDirectory()
    await fs.mkdir(`${namespaceDirectory}/applications`)
    await fs.mkdir(`${namespaceDirectory}/services/a`, { recursive: true })
    await fs.writeFile(`${namespaceDirectory}/applications/pr-123--a.yaml`, existingApplicationA)
    await fs.writeFile(`${namespaceDirectory}/services/a/generated.yaml`, 'this-should-be-kept')

    const services = await syncServicesFromPrebuilt({
      applicationContext: {
        overlay: 'pr',
        namespace: 'pr-123',
        project: 'source-repository',
        destinationRepository: 'octocat/destination-repository',
      },
      changedServices: ['a'],
      prebuiltBranch: {
        name: 'prebuilt/source-repository/pr',
        directory: `${import.meta.dirname}/fixtures/prebuilt`,
        aggregateToNamespaceDirectory: false,
      },
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    assert.deepStrictEqual<Service[]>(services, [
      {
        service: 'a',
        builtFrom: {
          pullRequest: {
            headRef: 'topic-branch',
            headSha: 'topic-sha',
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
      {
        service: 'c',
        builtFrom: {
          prebuilt: {
            prebuiltBranch: 'prebuilt/source-repository/pr',
            builtFrom: { headRef: 'main', headSha: 'main-branch-sha' },
          },
        },
      },
    ])

    assert.deepStrictEqual(await fs.readdir(`${namespaceDirectory}/applications`), [
      'pr-123--a.yaml',
      'pr-123--b.yaml',
      'pr-123--c.yaml',
    ])
    assert.strictEqual(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`), existingApplicationA)
    assert.deepStrictEqual(await fs.readdir(`${namespaceDirectory}/services`), ['a', 'b', 'c'])
    assert.strictEqual(await readContent(`${namespaceDirectory}/services/a/generated.yaml`), 'this-should-be-kept')
  })

  it('deletes a service which does not exist in the prebuilt branch', async () => {
    const namespaceDirectory = await createEmptyDirectory()
    await fs.mkdir(`${namespaceDirectory}/applications`)
    await fs.writeFile(`${namespaceDirectory}/applications/pr-123--outdated.yaml`, `this-should-be-deleted`)

    const services = await syncServicesFromPrebuilt({
      applicationContext: {
        overlay: 'pr',
        namespace: 'pr-123',
        project: 'source-repository',
        destinationRepository: 'octocat/destination-repository',
      },
      changedServices: [],
      prebuiltBranch: {
        name: 'prebuilt/source-repository/pr',
        directory: `${import.meta.dirname}/fixtures/prebuilt`,
        aggregateToNamespaceDirectory: false,
      },
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    assert.deepStrictEqual<Service[]>(services, [
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
      {
        service: 'c',
        builtFrom: {
          prebuilt: {
            prebuiltBranch: 'prebuilt/source-repository/pr',
            builtFrom: { headRef: 'main', headSha: 'main-branch-sha' },
          },
        },
      },
    ])
    assert.deepStrictEqual(await fs.readdir(`${namespaceDirectory}/applications`, { recursive: true }), [
      'pr-123--a.yaml',
      'pr-123--b.yaml',
      'pr-123--c.yaml',
      // pr-123--outdated.yaml should not exist
    ])
    assert.strictEqual(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`), applicationA)
    assert.strictEqual(await readContent(`${namespaceDirectory}/applications/pr-123--b.yaml`), applicationB)
    assert.deepStrictEqual(await fs.readdir(`${namespaceDirectory}/services`), ['a', 'b', 'c'])
  })

  it('copies the manifests from the overridden prebuilt branch', async () => {
    const namespaceDirectory = await createEmptyDirectory()

    const services = await syncServicesFromPrebuilt({
      applicationContext: {
        overlay: 'pr',
        namespace: 'pr-123',
        project: 'source-repository',
        destinationRepository: 'octocat/destination-repository',
      },
      changedServices: ['b'],
      prebuiltBranch: {
        name: 'prebuilt/source-repository/pr',
        directory: `${import.meta.dirname}/fixtures/prebuilt`,
        aggregateToNamespaceDirectory: false,
      },
      override: {
        services: ['c'],
        prebuiltBranch: {
          name: 'prebuilt/source-repository/pr/override',
          directory: `${import.meta.dirname}/fixtures/override-prebuilt`,
        },
      },
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    assert.deepStrictEqual<Service[]>(services, [
      {
        service: 'a',
        builtFrom: {
          prebuilt: {
            prebuiltBranch: 'prebuilt/source-repository/pr',
            builtFrom: { headRef: 'main', headSha: 'main-branch-sha' },
          },
        },
      },
      // Service b does not exist. It will be deployed by another workflow.
      {
        service: 'c',
        builtFrom: {
          prebuilt: {
            prebuiltBranch: 'prebuilt/source-repository/pr/override',
            builtFrom: { headRef: 'main', headSha: 'main-branch-sha' },
          },
        },
      },
    ])
    assert.deepStrictEqual(await fs.readdir(`${namespaceDirectory}/applications`), [
      'pr-123--a.yaml',
      // pr-123--b.yaml should not exist
      'pr-123--c.yaml',
    ])
    assert.strictEqual(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`), applicationA)
    assert.strictEqual(await readContent(`${namespaceDirectory}/applications/pr-123--c.yaml`), applicationC)
    assert.deepStrictEqual(await fs.readdir(`${namespaceDirectory}/services`), ['a', 'c'])
    assert.strictEqual(await readContent(`${namespaceDirectory}/services/a/generated.yaml`), serviceA)
    assert.strictEqual(await readContent(`${namespaceDirectory}/services/c/generated.yaml`), serviceC)
  })
})

describe('syncServicesFromPrebuilt with aggregateToNamespaceDirectory', () => {
  it('copies the manifests from the prebuilt branch', async () => {
    const namespaceDirectory = await createEmptyDirectory()

    const services = await syncServicesFromPrebuilt({
      applicationContext: {
        overlay: 'pr',
        namespace: 'pr-123',
        project: 'source-repository',
        destinationRepository: 'octocat/destination-repository',
      },
      changedServices: [],
      prebuiltBranch: {
        name: 'prebuilt/source-repository/pr',
        directory: `${import.meta.dirname}/fixtures/prebuilt`,
        aggregateToNamespaceDirectory: true,
      },
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    assert.deepStrictEqual<Service[]>(services, [
      // No services. They will be put into the namespace branch.
    ])

    assert.deepStrictEqual(await fs.readdir(`${namespaceDirectory}/applications`), [
      'pr-123--a--generated.yaml',
      'pr-123--b--generated.yaml',
      'pr-123--c--generated.yaml',
    ])
    assert.strictEqual(await readContent(`${namespaceDirectory}/applications/pr-123--a--generated.yaml`), serviceA)
    assert.strictEqual(await readContent(`${namespaceDirectory}/applications/pr-123--b--generated.yaml`), serviceB)
    assert.strictEqual(await readContent(`${namespaceDirectory}/applications/pr-123--c--generated.yaml`), serviceC)
  })

  it('does not overwrite the changed services', async () => {
    const namespaceDirectory = await createEmptyDirectory()
    await fs.mkdir(`${namespaceDirectory}/applications`)
    await fs.mkdir(`${namespaceDirectory}/services/a`, { recursive: true })
    await fs.writeFile(`${namespaceDirectory}/applications/pr-123--a.yaml`, existingApplicationA)
    await fs.writeFile(`${namespaceDirectory}/services/a/generated.yaml`, 'this-should-be-kept')

    const services = await syncServicesFromPrebuilt({
      applicationContext: {
        overlay: 'pr',
        namespace: 'pr-123',
        project: 'source-repository',
        destinationRepository: 'octocat/destination-repository',
      },
      changedServices: ['a'],
      prebuiltBranch: {
        name: 'prebuilt/source-repository/pr',
        directory: `${import.meta.dirname}/fixtures/prebuilt`,
        aggregateToNamespaceDirectory: true,
      },
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    assert.deepStrictEqual<Service[]>(services, [
      {
        service: 'a',
        builtFrom: {
          pullRequest: {
            headRef: 'topic-branch',
            headSha: 'topic-sha',
          },
        },
      },
      // Service b does not exist. It will be put into the namespace branch.
    ])

    assert.deepStrictEqual(await fs.readdir(`${namespaceDirectory}/applications`), [
      'pr-123--a.yaml',
      'pr-123--b--generated.yaml',
      'pr-123--c--generated.yaml',
    ])
    assert.strictEqual(await readContent(`${namespaceDirectory}/applications/pr-123--a.yaml`), existingApplicationA)
    assert.strictEqual(await readContent(`${namespaceDirectory}/applications/pr-123--b--generated.yaml`), serviceB)
    assert.deepStrictEqual(await fs.readdir(`${namespaceDirectory}/services`), ['a'])
    assert.strictEqual(await readContent(`${namespaceDirectory}/services/a/generated.yaml`), 'this-should-be-kept')
  })

  it('copies the manifests from the overridden prebuilt branch', async () => {
    const namespaceDirectory = await createEmptyDirectory()

    const services = await syncServicesFromPrebuilt({
      applicationContext: {
        overlay: 'pr',
        namespace: 'pr-123',
        project: 'source-repository',
        destinationRepository: 'octocat/destination-repository',
      },
      changedServices: ['b'],
      prebuiltBranch: {
        name: 'prebuilt/source-repository/pr',
        directory: `${import.meta.dirname}/fixtures/prebuilt`,
        aggregateToNamespaceDirectory: true,
      },
      override: {
        services: ['c'],
        prebuiltBranch: {
          name: 'prebuilt/source-repository/pr/override',
          directory: `${import.meta.dirname}/fixtures/override-prebuilt`,
        },
      },
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    assert.deepStrictEqual<Service[]>(services, [
      // Service a does not exist. It will be put into the namespace branch.
      // Service b does not exist. It will be deployed by another workflow.
      {
        service: 'c',
        builtFrom: {
          prebuilt: {
            prebuiltBranch: 'prebuilt/source-repository/pr/override',
            builtFrom: { headRef: 'main', headSha: 'main-branch-sha' },
          },
        },
      },
    ])
    assert.deepStrictEqual(await fs.readdir(`${namespaceDirectory}/applications`), [
      'pr-123--a--generated.yaml',
      // pr-123--b.yaml should not exist
      'pr-123--c.yaml',
    ])
    assert.strictEqual(await readContent(`${namespaceDirectory}/applications/pr-123--a--generated.yaml`), serviceA)
    assert.strictEqual(await readContent(`${namespaceDirectory}/applications/pr-123--c.yaml`), applicationC)
    assert.deepStrictEqual(await fs.readdir(`${namespaceDirectory}/services`), ['c'])
    assert.strictEqual(await readContent(`${namespaceDirectory}/services/c/generated.yaml`), serviceC)
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

const existingApplicationA = `\
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
    github.head-sha: topic-sha
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

const applicationC = `\
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: pr-123--c
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
  annotations:
    github.action: bootstrap-pull-request
    github.head-ref: main
    github.head-sha: main-branch-sha
    built-from-prebuilt-branch: prebuilt/source-repository/pr/override
spec:
  project: source-repository
  source:
    repoURL: https://github.com/octocat/destination-repository.git
    targetRevision: ns/source-repository/pr/pr-123
    path: services/c
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

const serviceC = `\
# fixture
name: c
namespace: pr-123
`
