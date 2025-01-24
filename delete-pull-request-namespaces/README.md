# :warning: DEPRECATED

Use [the pull request generator](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-Pull-Request/) instead.
This action will be removed in the future.

---

# delete-pull-request-namespaces [![delete-pull-request-namespaces](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/delete-pull-request-namespaces.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/delete-pull-request-namespaces.yaml)

This is an action to delete pull request namespaces.

For cost saving and reliability of the Kubernetes cluster,
it would be nice to delete the namespaces every night.

## Getting Started

To delete pull request namespaces every night,

```yaml
name: pr-namespace / stop-nightly

on:
  schedule:
    - cron: '0 22 * * *' # change to your timezone
  pull_request:
    paths:
      # to test this workflow
      - .github/workflows/pr-namespace--stop-nightly.yaml

jobs:
  delete-namespaces:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: quipper/monorepo-deploy-actions/delete-pull-request-namespaces@v1
        with:
          dry-run: ${{ github.event_name == 'pull_request' }}
          overlay: pr
          namespace-prefix: pr-
          destination-repository: octocat/generated-manifests
          destination-branch: main
          destination-repository-token: ${{ steps.destination-repository-github-app.outputs.token }}
          exclude-label: skip-nightly-stop
          remove-label-on-deletion: deploy
          comment-on-deletion: |
            :zzz: This namespace has been deleted. Add `deploy` label to deploy it again.
```

### How it works

This action assumes that the destination branch has Argo CD application files as below structure.

```
.
└── ${project}
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

- If a pull request is open and has the label `skip-nightly-stop`, this action does not delete it.
  It is useful for long running tests.
- If a pull request was recently updated, this action does not delete it.
  Argo CD Application becomes stuck on deletion if the PreSync hook is running.

Finally, it notifies the deletion to each pull request as follows:

- Remove `deploy` label which indicates the namespace is deployed
- Add a comment

### .keep is required

You need to add `${project}/${overlay}/.keep` into the destination directory.
This action fails if the directory `${project}/${overlay}` does not exist.
It is by design to notice a problem.

## Specification

See [action.yaml](action.yaml).
