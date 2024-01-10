# update-outdated-pull-request-branch [![update-outdated-pull-request-branch](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/update-outdated-pull-request-branch.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/update-outdated-pull-request-branch.yaml)

This is an action to update the pull request if the head commit is outdated.

## Problem to solve

When an outdated pull request is deployed again by `git-push-namespace` action,

- The generated manifests in the namespace branch is outdated. It may cause some problem.
- A container image may be expired, such as an ECR lifecycle policy.

It would be nice to automatically update an outdated pull request.

## Getting Started

To update the current pull request if the head commit is older that 14 days,

```yaml
jobs:
  update-outdated-pull-request-branch:
    runs-on: ubuntu-latest
    steps:
      - uses: quipper/monorepo-deploy-actions/update-outdated-pull-request-branch@v1
        with:
          expiration-days: 14
```

This action must be called on `pull_request` event.

To trigger a workflow against the updated commit, you need to pass a PAT or GitHub App token.
