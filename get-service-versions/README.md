# get-service-versions [![get-service-versions](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/get-service-versions.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/get-service-versions.yaml)

This is an action to get service versions (commit hash) pushed by `git-push-service` action.

## Getting Started

```yaml
name: pr-namespace / get-service-versions

on:
  pull_request:

jobs:
  get-service-versions:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: quipper/monorepo-deploy-actions/get-service-versions@v1
        with:
          namespace: pr-${{ github.event.number }}
          repository: octocat/generated-manifests
          repository-token: ${{ steps.destination-repository-github-app.outputs.token }}
```

It assumes that the below name of prebuilt branch exists in the destination repository.

```
prebuilt/${source-repository}/${overlay}
```

## Specification

See [action.yaml](action.yaml).
