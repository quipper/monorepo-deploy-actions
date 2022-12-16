# environment-matrix [![environment-matrix](https://github.com/int128/typescript-actions-monorepo/actions/workflows/environment-matrix.yaml/badge.svg)](https://github.com/int128/typescript-actions-monorepo/actions/workflows/environment-matrix.yaml)

This action generates a JSON string for matrix deploy.


## Getting Started

Here is an example.

```yaml
jobs:
  environment-matrix:
    runs-on: ubuntu-latest
    outputs:
      json: ${{ steps.environment-matrix.outputs.json }}
    steps:
      - uses: int128/typescript-actions-monorepo/environment-matrix@v1
        id: environment-matrix
        with:
          rules: |
            - pull_request:
                base: '**'
                head: '**'
              environments:
                - overlay: pr
                  namespace: pr-${{ github.event.pull_request.number }}
            - push:
                ref: refs/heads/main
              environments:
                - overlay: development
                  namespace: development
```


## Inputs

| Name | Type | Description
|------|----------|---------
| `rules` | `string` | YAML string of rules


## Outputs

| Name | Description
|------|------------
| `json` | JSON string of environments
