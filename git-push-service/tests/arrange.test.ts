import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { it } from 'node:test'
import { writeManifests } from '../src/arrange.ts'

const readContent = async (f: string) => await fs.readFile(f, 'utf-8')

it('writes the service and application manifests', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-action-'))

  await writeManifests({
    workspace,
    manifests: [path.join(import.meta.dirname, `fixtures/a/generated.yaml`)],
    branch: `ns/project/overlay/namespace`,
    namespace: 'namespace',
    service: 'a',
    project: 'project',
    applicationAnnotations: ['example=foo'],
    destinationRepository: 'octocat/manifests',
    currentHeadRef: 'refs/heads/main',
    currentHeadSha: '1234567890abcdef',
  })

  assert.strictEqual(await readContent(path.join(workspace, `applications/namespace--a.yaml`)), applicationA)
  assert.strictEqual(
    await readContent(path.join(workspace, `services/a/generated.yaml`)),
    await readContent(path.join(import.meta.dirname, `fixtures/a/generated.yaml`)),
  )
})

it('concatenates the service manifests if multiple are given', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-action-'))

  await writeManifests({
    workspace,
    manifests: [
      path.join(import.meta.dirname, `fixtures/a/generated.yaml`),
      path.join(import.meta.dirname, `fixtures/b/generated.yaml`),
    ],
    branch: `ns/project/overlay/namespace`,
    namespace: 'namespace',
    service: 'service',
    project: 'project',
    applicationAnnotations: ['example=foo'],
    destinationRepository: 'octocat/manifests',
    currentHeadRef: 'refs/heads/main',
    currentHeadSha: '1234567890abcdef',
  })

  assert.strictEqual(
    await readContent(path.join(workspace, `services/service/generated.yaml`)),
    `\
${await readContent(path.join(import.meta.dirname, `fixtures/a/generated.yaml`))}
---
${await readContent(path.join(import.meta.dirname, `fixtures/b/generated.yaml`))}`,
  )
})

it('overwrites if a file exists', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-action-'))

  // put dummy files
  await fs.mkdir(path.join(workspace, `applications`))
  await fs.writeFile(path.join(workspace, `applications/namespace--a.yaml`), 'fixture-application-manifest')
  await fs.mkdir(path.join(workspace, `services`))
  await fs.mkdir(path.join(workspace, `services/a`))
  await fs.writeFile(path.join(workspace, `services/a/generated.yaml`), 'fixture-generated-manifest')

  await writeManifests({
    workspace,
    manifests: [path.join(import.meta.dirname, `fixtures/a/generated.yaml`)],
    branch: `ns/project/overlay/namespace`,
    namespace: 'namespace',
    service: 'a',
    project: 'project',
    applicationAnnotations: ['example=foo'],
    destinationRepository: 'octocat/manifests',
    currentHeadRef: 'refs/heads/main',
    currentHeadSha: '1234567890abcdef',
  })

  assert.strictEqual(await readContent(path.join(workspace, `applications/namespace--a.yaml`)), applicationA)
  assert.strictEqual(
    await readContent(path.join(workspace, `services/a/generated.yaml`)),
    await readContent(path.join(import.meta.dirname, `fixtures/a/generated.yaml`)),
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
    example: foo
    github.head-ref: refs/heads/main
    github.head-sha: 1234567890abcdef
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
