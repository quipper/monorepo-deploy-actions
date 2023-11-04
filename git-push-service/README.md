# git-push-service

This is an action to push a service manifest into a namespace branch.

If you need to push a manifest into the namespace level, use [bootstrap-pull-request](../bootstrap-pull-request) action instead.

## Inputs

| Name                      | Type             | Description                                                             |
| ------------------------- | ---------------- | ----------------------------------------------------------------------- |
| `manifests`               | multiline string | Glob pattern of file(s)                                                 |
| `overlay`                 | string           | Name of overlay                                                         |
| `namespace`               | string           | Name of namespace                                                       |
| `service`                 | string           | Name of service                                                         |
| `application-annotations` | multiline string | Annotations to add to an Application (default to empty)                 |
| `destination-repository`  | string           | Destination repository                                                  |
| `destination-branch`      | string           | Destination branch (default to `ns/${project}/${overlay}/${namespace}`) |
| `update-via-pull-request` | boolean          | Update a branch via a pull request (default to false)                   |
| `token`                   | string           | GitHub token (default to `github.token`)                                |

If `manifests` do not match anything, this action does nothing.

## Outputs

| Name                              | Type   | Description                                                  |
| --------------------------------- | ------ | ------------------------------------------------------------ |
| `destination-pull-request-number` | number | Pull request number if created in the destination repository |
| `destination-pull-request-url`    | string | URL of pull request if created in the destination repository |

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
    destination-branch: prebuilt/REPOSITORY/pr
```

It pushes the following file into a destination repository:

```
destination-repository (branch: prebuilt/${project}/${overlay})
└── services
    └── ${service}
        └── generated.yaml
```

You can build the prebuilt manifest using [git-push-services-from-prebuilt action](../git-push-services-from-prebuilt).

## Options

### Update strategy of namespace branch

This action updates a namespace branch via a pull request.
It brings the following benefits:

- It would avoid the retries of fast-forward when many jobs are running concurrently
- You can revert a change of manifest by clicking "Revert" button in a pull request

You can turn on this feature by `update-via-pull-request` flag.
