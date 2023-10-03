# cleanup-closed-pull-requests [![cleanup-closed-pull-requests](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/cleanup-closed-pull-requests.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/cleanup-closed-pull-requests.yaml)

This is an action to delete the namespaces of closed pull requests.

For cost saving and reliability of the Kubernetes cluster,
it would be nice to delete the namespaces priodically.

## Getting Started

To clean up the namespaces of closed pull requests,

```yaml
name: pr-namespace / cleanup

on:
  schedule:
    - cron: '*/30 * * * *' # every 30 minutes
  pull_request:
    paths:
      # to test this workflow
      - .github/workflows/pr-namespace--cleanup.yaml

jobs:
  cleanup-closed-pull-requests:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: quipper/monorepo-deploy-actions/cleanup-closed-pull-requests@v1
        with:
          dry-run: ${{ github.event_name == 'pull_request' }}
          overlay: pr
          namespace-prefix: pr-
          destination-repository: octocat/generated-manifests
          destination-branch: main
          destination-repository-token: ${{ steps.destination-repository-github-app.outputs.token }}
```

This action deletes both namespace applications and branches.

### Namespace applications

It assumes that the destination branch has Argo CD application files as below structure.

```
.
└── ${source-repository}
    └── ${overlay}
        └── ${namespace-prefix}${pull-request-number}.yaml
```

For example,

```
.
└── monorepo
    └── pr
        ├── .keep
        ├── pr-100.yaml
        ├── pr-101.yaml
        └── pr-102.yaml
```

It deletes applications by the following rules:

- If a pull request is open, this action does not delete it.
- If a pull request was recently updated, this action does not delete it.
  Argo CD Application becomes stuck on deletion if the PreSync hook is running.
- Otherwise, delete it.

### Namespace branches

It assumes that the destination repository has the following branches:

```
ns/${source-repository}/${overlay}/${namespace-prefix}${pull-request-number}
```

For example,

```
ns/monorepo/pr/pr-100
ns/monorepo/pr/pr-101
ns/monorepo/pr/pr-102
```

It deletes branches by the following rules:

- If both namespace application and namespace branch exist, this action does not delete it.
- Otherwise, delete it.

## Specification

See [action.yaml](action.yaml).
