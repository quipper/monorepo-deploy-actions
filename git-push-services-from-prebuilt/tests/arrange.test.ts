import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import { arrangeManifests } from '../src/arrange'

const readContent = async (f: string) => (await fs.readFile(f)).toString()

test('if workspace is empty, just create', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-from-prebuilt-'))

  await arrangeManifests({
    workspace,
    branch: `ns/project/overlay/namespace`,
    namespace: 'namespace',
    project: 'project',
    context: { sha: 'current_sha', ref: 'refs/heads/main' },
    prebuiltDirectory: path.join(__dirname, `fixtures/prebuilt`),
    destinationRepository: 'octocat/manifests',
  })

  expect(await readContent(path.join(workspace, `applications/namespace--a.yaml`))).toBe(applicationA)
  expect(await readContent(path.join(workspace, `services/a/generated.yaml`))).toBe(
    await readContent(path.join(__dirname, `fixtures/prebuilt/services/a/generated.yaml`))
  )
  expect(await readContent(path.join(workspace, `applications/namespace--b.yaml`))).toBe(applicationB)
  expect(await readContent(path.join(workspace, `services/b/generated.yaml`))).toBe(
    await readContent(path.join(__dirname, `fixtures/prebuilt/services/b/generated.yaml`))
  )
})

test('if service was pushed by git-push-services-from-prebuilt, overwrite it', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-from-prebuilt-'))

  await fs.mkdir(path.join(workspace, `applications`))
  await fs.writeFile(path.join(workspace, `applications/namespace--a.yaml`), applicationA)
  await fs.mkdir(path.join(workspace, `services`))
  await fs.mkdir(path.join(workspace, `services/a`))
  await fs.writeFile(path.join(workspace, `services/a/generated.yaml`), 'dummy-generated-manifest')

  await arrangeManifests({
    workspace,
    branch: `ns/project/overlay/namespace`,
    namespace: 'namespace',
    project: 'project',
    context: { sha: 'current_sha', ref: 'refs/heads/main' },
    prebuiltDirectory: path.join(__dirname, `fixtures/prebuilt`),
    destinationRepository: 'octocat/manifests',
  })

  expect(await readContent(path.join(workspace, `applications/namespace--a.yaml`))).toBe(applicationA)
  expect(await readContent(path.join(workspace, `services/a/generated.yaml`))).toBe(
    await readContent(path.join(__dirname, `fixtures/prebuilt/services/a/generated.yaml`))
  )
})

test('if service was pushed by git-push-service, do not overwrite it', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-from-prebuilt-'))

  await fs.mkdir(path.join(workspace, `applications`))
  await fs.writeFile(path.join(workspace, `applications/namespace--a.yaml`), applicationPushedByGitPushService)
  await fs.mkdir(path.join(workspace, `services`))
  await fs.mkdir(path.join(workspace, `services/a`))
  await fs.writeFile(path.join(workspace, `services/a/generated.yaml`), 'dummy-generated-manifest')

  await arrangeManifests({
    workspace,
    branch: `ns/project/overlay/namespace`,
    namespace: 'namespace',
    project: 'project',
    context: { sha: 'current_sha', ref: 'refs/heads/main' },
    prebuiltDirectory: path.join(__dirname, `fixtures/prebuilt`),
    destinationRepository: 'octocat/manifests',
  })

  expect(await readContent(path.join(workspace, `applications/namespace--a.yaml`))).toBe(
    applicationPushedByGitPushService
  )
  expect(await readContent(path.join(workspace, `services/a/generated.yaml`))).toBe('dummy-generated-manifest')
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
    github.action: git-push-services-from-prebuilt
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

const applicationPushedByGitPushService = `\
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: namespace--a
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
  annotations:
    github.action: git-push-service
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
    github.action: git-push-services-from-prebuilt
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
