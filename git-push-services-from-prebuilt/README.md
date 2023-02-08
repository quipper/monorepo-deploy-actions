# git-push-services-from-prebuilt

This is an action to push services from prebuilt manifests.


## Inputs

Name | Type | Description
-----|------|------------
`prebuilt-directory` | string | Path to directory of prebuilt manifests
`overlay` | string | Name of overlay
`namespace` | string | Name of namespace
`destination-repository` | string | Destination repository
`token` | string | GitHub token (default to `github.token`)


## Getting Started

To bootstrap a pull request namespace from the prebuilt manifests:

```yaml
jobs:
  bootstrap-with-prebuilt-manifests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          ref: prebuilt/REPOSITORY/pr
          path: prebuilt
      - uses: quipper/monorepo-deploy-actions/substitute@v1
        with:
          files: prebuilt/services/**/*.yaml
          variables: NAMESPACE=pr-1
      - uses: quipper/monorepo-deploy-actions/git-push-services-from-prebuilt@v1
        with:
          prebuilt-directory: prebuilt
          overlay: pr
          namespace: pr-1
```

This action pushes the following files into a destination repository:

```
destination-repository (branch: ns/${project}/${overlay}/${namespace})
├── applications
|   └── ${namespace}--${service}.yaml
└── services
    └── ${service}
        └── generated.yaml
```

It generates an `Application` manifest with the following properties:

- metadata
  - name: `${namespace}--${service}`
  - namespace: `argocd`
  - annotations: if given
- source
  - repoURL: `https://github.com/${destination-repository}.git`
  - targetRevision: `ns/${project}/${overlay}/${namespace}`
  - path: `services/${service}`
- destination
  - namespace: `${namespace}`


## Caveat

`git-push-service` and `git-push-services-from-prebuilt` may run concurrently.
If an application manifest was pushed by `git-push-service`, this action does not overwrite it.

**Case 1**: If a service is not changed in a pull request,

1. When a pull request is created,
    - `git-push-services-from-prebuilt` pushes the prebuilt manifest
1. When the pull request is synchronized,
    - `git-push-services-from-prebuilt` overwrites the manifest.
      This is needed to follow the latest prebuilt manifest

**Case 2**: If a service is changed in a pull request,

1. When a pull request is created,
    - `git-push-services-from-prebuilt` pushes the prebuilt manifest
    - `git-push-service` overwrites the manifest
1. When the pull request is synchronized,
    - `git-push-services-from-prebuilt` don't overwrite it
