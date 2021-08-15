import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import { addNamespace } from '../src/add'

test('add a namespace', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-namespace-'))

  await addNamespace({
    workspace,
    overlay: 'overlay',
    namespace: 'namespace',
    project: 'project',
    destinationRepository: 'octocat/manifests',
  })

  expect(await readContent(path.join(workspace, `project/overlay/namespace.yaml`))).toBe(expectedApplication)
})

const readContent = async (f: string) => (await fs.readFile(f)).toString()

const expectedApplication = `\
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: namespace
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: project
  source:
    repoURL: https://github.com/octocat/manifests.git
    targetRevision: ns/project/overlay/namespace
    path: applications
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      prune: true
`
