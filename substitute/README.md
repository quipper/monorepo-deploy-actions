# substitute

This is a general-purpose action to substitute variable(s) in file(s).


## Inputs

Name | Type | Description
-----|------|------------
`files` | multiline string | Glob pattern of file(s)
`path-variables-pattern` | string (optional) | Path variable(s)
`variables` | multiline string | Variable(s) in form of `KEY=VALUE`


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

### Path variables

This action tests pattern match to each path when `path-variables-pattern` is set.
You can refer the path variable(s) in `variables`.

`path-variables-pattern` supports a preliminary glob pattern. It consists of the following path elements:

- `*` (any string except `/`)
- `**` (any string)
- `${KEY}` (path variable)

A path variable key must be alphabet, number or underscore, i.e. `a-zA-Z0-9_`.

For example, when the following file is given,

If you set `path-variables-pattern`, this action tests each manifest path and sets the path variable(s).
You can use the path variable(s) in `variables`.

finally path variable `service` is set to `foo`.
