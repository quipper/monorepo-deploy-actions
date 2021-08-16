# git-push-namespace

This is an action to push an Argo CD `Application` manifest to deploy a namespace.


## Inputs

Name | Type | Description
-----|------|------------
`overlay` | string | Name of overlay
`namespace` | multiline string | Name of namespace
`destination-repository` | string | Destination repository (default to `github.repository`)
`destination-branch` | string | Destination branch (default to `main`)
`token` | string | GitHub token (default to `github.token`)


## Getting Started

To add a namespace:

```yaml
    steps:
      - uses: quipper/monorepo-deploy-actions/git-push-namespace@v1
        with:
          overlay: staging
          namespace: pr-12345
```

This action writes an `Application` to `${project}/${overlay}/${namespace}.yaml` in the destination repository.
