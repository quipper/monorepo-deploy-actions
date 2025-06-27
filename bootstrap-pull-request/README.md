# bootstrap-pull-request [![bootstrap-pull-request](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/bootstrap-pull-request.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/bootstrap-pull-request.yaml)

This is an action to bootstrap the pull request namespace.
When a pull request is created or updated, this action copies the service manifests from the prebuilt branch.

## Getting Started

To bootstrap the pull request namespace,

```yaml
name: pr-namespace / bootstrap

on:
  pull_request:

jobs:
  bootstrap-pull-request:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: int128/list-matched-workflows-action@v0
        id: list-matched-workflows
        with:
          workflows: |
            .github/workflows/*--deploy.yaml
      - uses: actions/github-script@v7
        id: preserve-services
        env:
          matched_workflows_json: ${{ steps.list-matched-workflows.outputs.matched-workflows-json }}
        with:
          result-encoding: string
          script: |
            // It assumes that the workflow files are named like service--deploy.yaml
            return JSON.parse(process.env.matched_workflows_json)
              .map((workflow) => workflow.filename.replace(/--.+$/, ''))
              .join('\n')
      - uses: quipper/monorepo-deploy-actions/bootstrap-pull-request@v1
        with:
          overlay: pr
          namespace: pr-${{ github.event.number }}
          destination-repository: octocat/generated-manifests
          preserve-services: ${{ steps.preserve-services.outputs.result }}
          prebuilt-branch: prebuilt/source-repository/main/workload
          destination-repository-token: ${{ steps.destination-repository-github-app.outputs.token }}
          substitute-variables: |
            NAMESPACE=pr-${{ github.event.number }}
```

This action creates a namespace branch into the destination repository.

```
ns/${source-repository}/${overlay}/${namespace-prefix}${pull-request-number}
```

It creates the following directory structure.

```
.
├── applications
|   └── ${namespace}--${service}.yaml
└── services
    └── ${service}
        └── generated.yaml
```

It bootstraps the namespace branch by the following steps:

1. Clean up the existing manifests
2. Copy the services from prebuilt branch
3. Copy the services from override directory (if specified)

### 1. Clean up the existing manifests

This action deletes the existing manifests in the namespace branch before copying.
It does not delete the services of `preserve-services` input.

### 2. Copy the services from prebuilt branch

This action copies the services from prebuilt branch to the namespace branch.
It does not copy the services of `preserve-services` input.

All placeholders will be replaced during copying the service manifests.
For example, if `NAMESPACE=pr-123` is given by `substitute-variables` input,
this action will replace `${NAMESPACE}` with `pr-123`.

### 3. Copy the services from override prebuilt directory

When `override-services` input is specified, this action copies the services from another prebuilt directory to the namespace branch.
It does not copy the services of `preserve-services` input.

## Specification

See [action.yaml](action.yaml).
