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
`update-via-pull-request` | boolean | Update a branch via a pull request (default to false)
`token` | string | GitHub token (default to `github.token`)


## Use-cases

### Push a manifest of a service

To push a manifest of a service:

```yaml
    steps:
      - uses: int128/kustomize-action@v1
        id: kustomize
        with:
          kustomization: foo/kubernetes/overlays/develop/kustomization.yaml
      - uses: quipper/monorepo-deploy-actions/git-push-service@v1
        with:
          manifests: ${{ steps.kustomize.outputs.files }}
          overlay: develop
          namespace: develop
          service: foo
```

It pushes the following files into a destination repository:

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


### Push a manifest to the namespace level

To push a manifest to the namespace level in App of Apps hierarchy:

```yaml
    steps:
      - uses: int128/kustomize-action@v1
        id: kustomize
        with:
          kustomization: deploy/namespace/kubernetes/overlays/pr/kustomization.yaml
      - uses: quipper/monorepo-deploy-actions/git-push-service@v1
        with:
          manifests: ${{ steps.kustomize.outputs.files }}
          overlay: pr
          namespace: pr-1
          namespace-level: true
```

It pushes the following file into a destination repository:

```
destination-repository (branch: ns/${project}/${overlay}/${namespace})
└── applications
    └── generated.yaml
```


### Push a manifest as a prebuilt one

To push a manifest as a prebuilt manifest:

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

It pushes the following file into a destination repository:

```
destination-repository (branch: prebuilt/${project}/${overlay}/${ref})
└── services
    └── ${service}
        └── generated.yaml
```

You can build the prebuilt manifest using [git-push-services-from-prebuilt action](../git-push-services-from-prebuilt).


## Options

### Update a branch via a pull request (experimental)

You can set `update-via-pull-request` flag to update a branch via a pull request.
It brings the following benefits:

- It would avoid the retries of fast-forward when many jobs are running concurrently
- You can revert a change of manifest by clicking "Revert" button in a pull request
