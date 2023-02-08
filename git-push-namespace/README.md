# git-push-namespace

This is an action to push an Argo CD `Application` manifest to deploy a namespace.


## Inputs

Name | Type | Description
-----|------|------------
`overlay` | string | Name of overlay
`namespace` | multiline string | Name of namespace
`destination-repository` | string | Destination repository
`destination-branch` | string | Destination branch (default to `main`)
`token` | string | GitHub token (default to `github.token`)


## Getting Started

To push a namespace manifest:

```yaml
    steps:
      - uses: quipper/monorepo-deploy-actions/git-push-namespace@v1
        with:
          overlay: staging
          namespace: pr-12345
```

It writes the following `Application` to `${project}/${overlay}/${namespace}.yaml` in the destination repository.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ${namespace}
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: project
  source:
    repoURL: https://github.com/octocat/manifests.git
    targetRevision: ns/${project}/${overlay}/${namespace}
    path: applications
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      prune: true
```

If the namespace branch `ns/${project}/${overlay}/${namespace}` does not exist, this action throws an error.
