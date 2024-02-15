# open-backport-pull-request

This is an action to open Backport Pull Requests from a specific branch.

This is useful in branching strategies like Gitflow, where a hotfix to the `main` branch needs to be backported to the `develop` branch afterwards.

## Getting Started

To create a backport pull request when a branch is changed:

```yaml
on:
  push:
    branches:
      - 'main'
      - '*/main'

jobs:
  backport:
    runs-on: ubuntu-latest
    steps:
      - id: backport
        name: Open Backport Pull Request
        uses: quipper/monorepo-deploy-actions/open-backport-pull-request@v1
        with:
          base-branch: develop
```

This action creates a working branch from the latest commit of head branch.
It creates a pull request from the working branch, because the head branch is protected typically.
When the pull request is conflicted, you can edit the working branch on GitHub.

### Skip workflow runs

You can set `skip-ci` to skip workflow runs for the backport pull request.
See https://docs.github.com/en/actions/managing-workflow-runs/skipping-workflow-runs for details.

### Automatically merge the pull request

You can set `merge-pull-request` to automatically merge the pull request.
If the action could not merge due to a conflict or branch protection rule, it requests a review to the actor.

## Specification

### Inputs

| Name                 | Default           | Description                                  |
| -------------------- | ----------------- | -------------------------------------------- |
| `github-token`       | `github.token`    | GitHub token used for opening a pull request |
| `base-branch`        | -                 | Base branch of the pull request              |
| `head-branch`        | `github.ref_name` | Head branch of the pull request              |
| `skip-ci`            | false             | Add `[skip ci]` to the commit message        |
| `merge-pull-request` | false             | Try to merge the pull request                |

### Outputs

| Name               | Description                                |
| ------------------ | ------------------------------------------ |
| `pull-request-url` | URL of the opened Pull Request             |
| `base-branch`      | The base branch of the opened Pull Request |
| `head-branch`      | The head branch of the opened Pull Request |
