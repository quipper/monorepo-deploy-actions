# substitute

This is a general-purpose action to substitute variable(s) in file(s).

## Inputs

| Name        | Type             | Description                        |
| ----------- | ---------------- | ---------------------------------- |
| `files`     | multiline string | Glob pattern of file(s)            |
| `variables` | multiline string | Variable(s) in form of `KEY=VALUE` |

## Getting Started

To build manifests and substitute variables:

```yaml
steps:
  - uses: int128/kustomize-action@v1
    id: kustomize
    with:
      kustomization: '*/kubernetes/overlays/staging/kustomization.yaml'
  - uses: quipper/monorepo-deploy-actions/substitute@v1
    with:
      files: ${{ steps.kustomize.outputs.directory }}
      path-variables-pattern: ${{ steps.kustomize.outputs.directory }}/${service}/**
      variables: |
        DOCKER_IMAGE=123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/${service}:develop
        NAMESPACE=develop
```

If no file is matched, this action does nothing.
