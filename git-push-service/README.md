# git-push-service

This is an action to push manifest(s) with Argo CD `Application` manifest(s) to deploy service(s).


## Inputs

Name | Type | Description
-----|------|------------
`manifests` | multiline string | Glob pattern of file(s)
`overlay` | string | Name of overlay
`namespace` | string | Name of namespace
`service` | string | Name of service
`namespace-level` | boolean | Push the manifests to namespace level (default to false)
`application-annotations` | multiline string | Annotations to add to an Application (default to empty)
`destination-repository` | string | Destination repository
`prebuilt` | boolean | Push prebuilt manifest (default to false)
`token` | string | GitHub token (default to `github.token`)


## Deploy a branch

To push a manifest on push event of a branch:

```yaml
    steps:
      - uses: int128/kustomize-action@v1
        id: kustomize
        with:
          kustomization: foo/kubernetes/overlays/develop/kustomization.yaml
      - uses: quipper/monorepo-deploy-actions/git-push-service@v1
        with:
          manifests: ${{ steps.kustomize.outputs.directory }}/**
          overlay: develop
          namespace: develop
          service: foo
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
  - path: `/services/${service}`
- destination
  - namespace: `${namespace}`


## Deploy a pull request

This section explains how to deploy a pull request.


### Push a prebuilt manifest on push event

Before deploying a pull request, you need to push a prebuilt manifest on push event of the default branch.

To push a prebuilt manifest:

```yaml
      - uses: int128/kustomize-action@v1
        id: kustomize
        with:
          kustomization: foo/kubernetes/overlays/pr/kustomization.yaml
      - uses: quipper/monorepo-deploy-actions/git-push-service@v1
        with:
          manifests: ${{ steps.kustomize.outputs.directory }}/**
          overlay: pr
          service: foo
          prebuilt: true
```

This action pushes the following file into a destination repository:

```
destination-repository (branch: prebuilt/${project}/${overlay}/${ref})
└── services
    └── ${service}
        └── generated.yaml
```


### Bootstrap a pull request

To push a manifest to the namespace level in App of Apps:

```yaml
    steps:
      - uses: int128/kustomize-action@v1
        id: kustomize
        with:
          kustomization: foo/kubernetes/overlays/pr/kustomization.yaml
      - uses: quipper/monorepo-deploy-actions/git-push-service@v1
        with:
          manifests: ${{ steps.kustomize.outputs.files }}
          overlay: pr
          namespace: pr-1
          namespace-level: true
```

This action pushes the following file into a destination repository:

```
destination-repository (branch: ns/${project}/${overlay}/${namespace})
└── applications
    └── generated.yaml
```

You also need to build the prebuilt manifests and push them.
See [git-push-services-from-prebuilt action](../git-push-services-from-prebuilt) for more.


### Push a manifest for pull request

To push a manifest:

```yaml
    steps:
      - uses: int128/kustomize-action@v1
        id: kustomize
        with:
          kustomization: foo/kubernetes/overlays/pr/kustomization.yaml
      - uses: quipper/monorepo-deploy-actions/git-push-service@v1
        with:
          manifests: ${{ steps.kustomize.outputs.directory }}/**
          overlay: pr
          namespace: pr-1
          service: foo
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
