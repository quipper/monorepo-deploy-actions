# create-deploy-pull-request [![create-deploy-pull-request](https://github.com/int128/typescript-actions-monorepo/actions/workflows/create-deploy-pull-request.yaml/badge.svg)](https://github.com/int128/typescript-actions-monorepo/actions/workflows/create-deploy-pull-request.yaml)

This action creates a pull request to deploy a service.

## Getting Started

To create a pull request from `release` to `production`,

```yaml
jobs:
  create:
    runs-on: ubuntu-latest
    steps:
      - uses: quipper/monorepo-deploy-actions/create-deploy-pull-request@v1
        with:
          head-branch: release
          base-branch: production
```

## Inputs

| Name          | Default        | Description                       |
| ------------- | -------------- | --------------------------------- |
| `head-branch` | (required)     | Name of head branch               |
| `base-branch` | (required)     | Name of base branch               |
| `title`       | (required)     | Title of pull request             |
| `body`        | (required)     | Body of pull request              |
| `labels`      | -              | Label of pull request (multiline) |
| `token`       | `github.token` | GitHub token                      |

## Outputs

None.
