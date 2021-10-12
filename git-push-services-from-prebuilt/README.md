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
          ref: ns/REPOSITORY/pr/prebuilt/refs/heads/main
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
