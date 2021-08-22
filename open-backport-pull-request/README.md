# open-backport-pull-request

This is an action to open Backport Pull Requests from a specific branch.

This is useful in branching strategies like Gitflow, where a hotfix to the `main` branch needs to be backported to the `develop` branch afterwards.

## Usage

```yaml
on:
  push:
    branches:
      - 'main'
      - '*/main'

  workflow_dispatch:
    inputs:
      headBranch:
        description: Target branch to backport from
        required: true

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

## Inputs

| Name           | Required | Default         | Description
|----------------|----------|-----------------|----------------------------------------------
| `github-token` | `true`   | `$github.token` | GitHub token used for opening a Pull Request
| `base-branch`  | `true`   |                 | Base branch of the Pull Request


## Outputs

| Name               | Description
|--------------------|-------------------------------
| `pull-request-url` | URL of the opened Pull Request
