import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import { arrangeManifests } from '../src/arrange'

const readContent = async (f: string) => (await fs.readFile(f)).toString()

test('arrange a service manifest', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-action-'))

  await arrangeManifests({
    workspace,
    manifests: [path.join(__dirname, `fixtures/a/generated.yaml`)],
    branch: `ns/project/overlay/namespace`,
    namespace: 'namespace',
    service: 'a',
    namespaceLevel: false,
    project: 'project',
    applicationAnnotations: ['github.ref=refs/heads/main'],
    destinationRepository: 'octocat/manifests',
  })

  expect(await readContent(path.join(workspace, `applications/namespace--a.yaml`))).toBe(applicationA)
  expect(await readContent(path.join(workspace, `services/a/generated.yaml`))).toBe(
    await readContent(path.join(__dirname, `fixtures/a/generated.yaml`)),
  )
})

it('should concatenate service manifests if multiple are given', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-action-'))

  await arrangeManifests({
    workspace,
    manifests: [path.join(__dirname, `fixtures/a/generated.yaml`), path.join(__dirname, `fixtures/b/generated.yaml`)],
    branch: `ns/project/overlay/namespace`,
    namespace: 'namespace',
    service: 'service',
    namespaceLevel: false,
    project: 'project',
    applicationAnnotations: ['github.ref=refs/heads/main'],
    destinationRepository: 'octocat/manifests',
  })

  expect(await readContent(path.join(workspace, `services/service/generated.yaml`))).toBe(`\
${await readContent(path.join(__dirname, `fixtures/a/generated.yaml`))}
---
${await readContent(path.join(__dirname, `fixtures/b/generated.yaml`))}`)
})

test('overwrite even if a file exists', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-action-'))

  // put dummy files
  await fs.mkdir(path.join(workspace, `applications`))
  await fs.writeFile(path.join(workspace, `applications/namespace--a.yaml`), 'fixture-application-manifest')
  await fs.mkdir(path.join(workspace, `services`))
  await fs.mkdir(path.join(workspace, `services/a`))
  await fs.writeFile(path.join(workspace, `services/a/generated.yaml`), 'fixture-generated-manifest')

  await arrangeManifests({
    workspace,
    manifests: [path.join(__dirname, `fixtures/a/generated.yaml`)],
    branch: `ns/project/overlay/namespace`,
    namespace: 'namespace',
    service: 'a',
    namespaceLevel: false,
    project: 'project',
    applicationAnnotations: ['github.ref=refs/heads/main'],
    destinationRepository: 'octocat/manifests',
  })

  expect(await readContent(path.join(workspace, `applications/namespace--a.yaml`))).toBe(applicationA)
  expect(await readContent(path.join(workspace, `services/a/generated.yaml`))).toBe(
    await readContent(path.join(__dirname, `fixtures/a/generated.yaml`)),
  )
})

const applicationA = `\
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: namespace--a
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
  annotations:
    github.ref: refs/heads/main
spec:
  project: project
  source:
    repoURL: https://github.com/octocat/manifests.git
    targetRevision: ns/project/overlay/namespace
    path: services/a
  destination:
    server: https://kubernetes.default.svc
    namespace: namespace
  syncPolicy:
    automated:
      prune: true
`

test('arrange a manifest into namespace level', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-action-'))

  // put dummy files
  await fs.mkdir(path.join(workspace, `applications`))
  await fs.writeFile(path.join(workspace, `applications/pr-123--namespace.yaml`), 'fixture-application-manifest')
  await fs.mkdir(path.join(workspace, `services`))
  await fs.mkdir(path.join(workspace, `services/namespace`))
  await fs.writeFile(path.join(workspace, `services/namespace/generated.yaml`), 'fixture-generated-manifest')

  await arrangeManifests({
    workspace,
    manifests: [path.join(__dirname, `fixtures/a/generated.yaml`)],
    branch: `ns/project/overlay/namespace`,
    namespace: 'pr-123',
    service: '',
    namespaceLevel: true,
    project: 'project',
    applicationAnnotations: ['github.ref=refs/heads/main'],
    destinationRepository: 'octocat/manifests',
  })

  expect(await readContent(path.join(workspace, `applications/generated.yaml`))).toBe(
    await readContent(path.join(__dirname, `fixtures/a/generated.yaml`)),
  )

  // make sure the old manifests are removed
  await expect(fs.stat(path.join(workspace, `applications/pr-123--namespace.yaml`))).rejects.toThrow()
  await expect(fs.stat(path.join(workspace, `services/namespace/generated.yaml`))).rejects.toThrow()
})
