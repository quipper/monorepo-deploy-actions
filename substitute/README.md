# substitute

This action substitutes variable(s) in manifest(s).


## Getting Started

To build manifests and substitute variables:

```yaml
    steps:
      - uses: int128/kustomize-action@v1
        id: kustomize
        with:
          kustomization: '*/kubernetes/overlays/gitops/staging/kustomization.yaml'
      - uses: quipper/monorepo-deploy-actions/substitute@v1
        with:
          manifests: ${{ steps.kustomize.outputs.files }}
          path-patterns: ${{ steps.kustomize.outputs.directory }}/:service_name/**
          variables: |
            DOCKER_IMAGE=${{ steps.ecr.outputs.registry }}/${service_name}:develop
            NAMESPACE=${{ steps.config.outputs.namespace }}
```

`variables` must be a multiline string in form of `KEY=VALUE`.

### Path pattern

If you set `path-patterns`, this action tests each manifest path and sets the path variable(s).
You can use the path variable(s) in `variables`.

A path variable must starts with `:` and be alphabet, number or underscore, i.e. `a-zA-Z0-9_`.
