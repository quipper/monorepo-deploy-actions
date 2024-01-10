# update-outdated-pull-request [![update-outdated-pull-request](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/update-outdated-pull-request.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/update-outdated-pull-request.yaml)

This is an action to update the pull request if the head commit is outdated.

## Getting Started

To update the current pull request if the head commit is older that 14 days,

```yaml
jobs:
  update-outdated-pull-request:
    runs-on: ubuntu-latest
    steps:
      - uses: quipper/monorepo-deploy-actions/update-outdated-pull-request@v1
        with:
          expiration-days: 14
```

This action must be called on `pull_request` event.

To trigger a workflow against the updated commit, you need to pass a PAT or GitHub App token.
