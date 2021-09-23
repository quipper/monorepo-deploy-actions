import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import { arrangeManifests } from '../src/arrange'
import { PathVariablesPattern } from '../src/match'

test('arrange a manifest', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-action-'))

  await arrangeManifests({
    workspace,
    manifests: [path.join(__dirname, `fixtures/a/generated.yaml`)],
    branch: `ns/project/overlay/namespace`,
    namespace: 'namespace',
    service: 'a',
    project: 'project',
    applicationAnnotations: ['github.ref=refs/heads/main'],
    destinationRepository: 'octocat/manifests',
    overwrite: false,
  })

  expect(await readContent(path.join(workspace, `applications/namespace--a.yaml`))).toBe(applicationA)
  expect(await readContent(path.join(workspace, `services/a/generated.yaml`))).toBe(
    await readContent(path.join(__dirname, `fixtures/a/generated.yaml`))
  )
})

test('do not overwrite if a file exists', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-action-'))

  // put dummy files
  await fs.mkdir(path.join(workspace, `applications`))
  await fs.writeFile(path.join(workspace, `applications/namespace--a.yaml`), 'dummy-application-manifest')
  await fs.mkdir(path.join(workspace, `services`))
  await fs.mkdir(path.join(workspace, `services/a`))
  await fs.writeFile(path.join(workspace, `services/a/generated.yaml`), 'dummy-generated-manifest')

  await arrangeManifests({
    workspace,
    manifests: [path.join(__dirname, `fixtures/a/generated.yaml`), path.join(__dirname, `fixtures/b/generated.yaml`)],
    branch: `ns/project/overlay/namespace`,
    namespace: 'namespace',
    service: new PathVariablesPattern(`${__dirname}/fixtures/\${service}/**`),
    project: 'project',
    applicationAnnotations: ['github.ref=refs/heads/main'],
    destinationRepository: 'octocat/manifests',
    overwrite: false,
  })

  expect(await readContent(path.join(workspace, `applications/namespace--a.yaml`))).toBe('dummy-application-manifest')
  expect(await readContent(path.join(workspace, `applications/namespace--b.yaml`))).toBe(applicationB)
  expect(await readContent(path.join(workspace, `services/a/generated.yaml`))).toBe('dummy-generated-manifest')
  expect(await readContent(path.join(workspace, `services/b/generated.yaml`))).toBe(
    await readContent(path.join(__dirname, `fixtures/b/generated.yaml`))
  )
})

test('overwrite event if a file exists', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-action-'))

  // put dummy files
  await fs.mkdir(path.join(workspace, `applications`))
  await fs.writeFile(path.join(workspace, `applications/namespace--a.yaml`), 'fixture-application-manifest')
  await fs.mkdir(path.join(workspace, `services`))
  await fs.mkdir(path.join(workspace, `services/a`))
  await fs.writeFile(path.join(workspace, `services/a/generated.yaml`), 'fixture-generated-manifest')

  await arrangeManifests({
    workspace,
    manifests: [path.join(__dirname, `fixtures/a/generated.yaml`), path.join(__dirname, `fixtures/b/generated.yaml`)],
    branch: `ns/project/overlay/namespace`,
    namespace: 'namespace',
    service: new PathVariablesPattern(`${__dirname}/fixtures/\${service}/**`),
    project: 'project',
    applicationAnnotations: ['github.ref=refs/heads/main'],
    destinationRepository: 'octocat/manifests',
    overwrite: true,
  })

  expect(await readContent(path.join(workspace, `applications/namespace--a.yaml`))).toBe(applicationA)
  expect(await readContent(path.join(workspace, `applications/namespace--b.yaml`))).toBe(applicationB)
  expect(await readContent(path.join(workspace, `services/a/generated.yaml`))).toBe(
    await readContent(path.join(__dirname, `fixtures/a/generated.yaml`))
  )
  expect(await readContent(path.join(workspace, `services/b/generated.yaml`))).toBe(
    await readContent(path.join(__dirname, `fixtures/b/generated.yaml`))
  )
})

const readContent = async (f: string) => (await fs.readFile(f)).toString()

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

const applicationB = `\
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: namespace--b
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
    path: services/b
  destination:
    server: https://kubernetes.default.svc
    namespace: namespace
  syncPolicy:
    automated:
      prune: true
`
