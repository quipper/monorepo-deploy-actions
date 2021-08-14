type Application = {
  name: string
  project: string
  namespace: string
  repository: string
  branch: string
  path: string
}

export const generateApplicationManifest = (s: Application): string => `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ${s.name}
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: ${s.project}
  source:
    repoURL: https://github.com/${s.repository}.git
    targetRevision: ${s.branch}
    path: ${s.path}
  destination:
    server: https://kubernetes.default.svc
    namespace: ${s.namespace}
  syncPolicy:
    automated:
      prune: true
`
