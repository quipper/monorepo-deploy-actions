# open-backport-pull-request

This is an action to open Backport Pull Requests from a specific branch.

This is useful in branching strategies like Gitflow, where a hotfix to the `main` branch needs to be backported to the `develop` branch afterwards.

## Usage

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

## Inputs

| Name           | Required | Default           | Description                                  |
| -------------- | -------- | ----------------- | -------------------------------------------- |
| `github-token` | `true`   | `github.token`    | GitHub token used for opening a Pull Request |
| `base-branch`  | `true`   |                   | Base branch of the Pull Request              |
| `head-branch`  | `true`   | `github.ref_name` | Head branch of the Pull Request              |

## Outputs

| Name               | Description                                |
| ------------------ | ------------------------------------------ |
| `pull-request-url` | URL of the opened Pull Request             |
| `base-branch`      | The base branch of the opened Pull Request |
| `head-branch`      | The head branch of the opened Pull Request |
