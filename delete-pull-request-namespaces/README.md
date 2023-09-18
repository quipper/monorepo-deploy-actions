# delete-pull-request-namespaces [![delete-pull-request-namespaces](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/delete-pull-request-namespaces.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/delete-pull-request-namespaces.yaml)

This is an action to delete pull request namespaces.

For cost saving and reliability of the Kubernetes cluster,
it would be nice to delete the namespaces every night.

## Getting Started

To delete pull request namespaces,

```yaml
name: pr-namespace / nightly-stop

jobs:
  delete:
    runs-on: ubuntu-latest
    steps:
      - uses: quipper/monorepo-deploy-actions/delete-pull-request-namespaces@v1
        with:
          overlay: pr
          namespace-prefix: pr-
          destination-repository: octocat/generated-manifests
          destination-branch: main
          destination-repository-token: ${{ steps.destination-repository-github-app.outputs.token }}
          exclude-label: skip-nightly-stop
          remove-label-on-deletion: deploy
          comment-on-deletion: |
            :zzz: This namespace has been deleted. Add `deploy` label to deploy again.
```

If a pull request has the label `skip-nightly-stop`, this action does not delete it.

If a pull request was updated within the window, this action does not delete it.
