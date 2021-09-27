# git-push-service

This is an action to push manifest(s) with Argo CD `Application` manifest(s) to deploy service(s).


## Inputs

Name | Type | Description
-----|------|------------
`manifests` | multiline string | Glob pattern of file(s)
`manifests-pattern` | string | Path pattern to determine a service name
`overlay` | string | Name of overlay
`namespace` | string | Name of namespace
`service` | string | Name of service
`application-annotations` | multiline string | Annotations to add to an Application (default to empty)
`destination-repository` | string | Destination repository
`overwrite` | boolean | Overwrite manifest(s) if it exists (default to true)
`token` | string | GitHub token (default to `github.token`)

Either `service` or `manifests-pattern` must be set.


## Getting Started

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


### Deploy a service

To build and push a manifest of service:

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


### Deploy multiple services

To build and push multiple manifests of services:

```yaml
    steps:
      - uses: int128/kustomize-action@v1
        id: kustomize
        with:
          kustomization: '*/kubernetes/overlays/develop/kustomization.yaml'
      - uses: quipper/monorepo-deploy-actions/git-push-service@v1
        with:
          manifests: ${{ steps.kustomize.outputs.directory }}/**
          manifests-pattern: ${{ steps.kustomize.outputs.directory }}/${service}/**
          overlay: develop
          namespace: develop
```

You need to include variable `${service}` in `manifests-pattern` to infer a service name from manifest path.
