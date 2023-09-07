# create-deploy-pull-request [![create-deploy-pull-request](https://github.com/int128/typescript-actions-monorepo/actions/workflows/create-deploy-pull-request.yaml/badge.svg)](https://github.com/int128/typescript-actions-monorepo/actions/workflows/create-deploy-pull-request.yaml)

This action creates a pull request to deploy a service.
It assumes a branch strategy such as Git Flow or GitLab Flow.

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
          title: Deploy from release to production
          body: |
            Hi @${{ github.actor }}
            This will deploy the services to production environment.
```

If the base branch does not exist, this action creates it from the head branch.
If a pull request already exists between head and base, this action does nothing.

This action appends the current timestamp to the title of pull request.
It is the local time in form of ISO 8601, such as `2023-09-07 15:01:02`.
You may need to set your `time-zone`.

### Pin head commit

It is not recommended to create a pull request from main branch directly,
because the head commit will be changed when main branch is updated.

To pin the head commit of a pull request,

```yaml
jobs:
  create:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: git push origin "refs/heads/main:refs/heads/main-${{ github.run_id }}"

      - uses: quipper/monorepo-deploy-actions/create-deploy-pull-request@v1
        with:
          head-branch: main-${{ github.run_id }}
          base-branch: release
          title: Deploy from main to release
          body: |
            Hi @${{ github.actor }}
            This will deploy the services to release environment.
```

## Specification

### Inputs

| Name          | Default        | Description                       |
| ------------- | -------------- | --------------------------------- |
| `head-branch` | (required)     | Name of head branch               |
| `base-branch` | (required)     | Name of base branch               |
| `title`       | (required)     | Title of pull request             |
| `body`        | (required)     | Body of pull request              |
| `labels`      | -              | Label of pull request (multiline) |
| `draft`       | `true`         | Set the pull request to draft     |
| `time-zone`   | -              | Time-zone for timestamp in title  |
| `token`       | `github.token` | GitHub token                      |

### Outputs

None.
