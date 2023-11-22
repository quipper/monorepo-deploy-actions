# environment-matrix [![environment-matrix](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/environment-matrix.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/environment-matrix.yaml)

This action generates a JSON string to deploy a service to environment(s) by the matrix jobs.

## Getting Started

Let's think about the following example:

- When a pull request is created, deploy it to `pr-NUMBER` namespace
- When `main` branch is pushed, deploy it to `development` namespace

It can be descibed as the following rules:

```yaml
- pull_request:
    base: '**'
    head: '**'
  environments:
    - overlay: pr
      namespace: pr-${{ github.event.pull_request.number }}
- push:
    ref: refs/heads/main
  environments:
    - overlay: development
      namespace: development
```

This action finds a rule matched to the current context.
If any rule is matched, this action returns a JSON string of `environments` field of the rule.
For example, when `main` branch is pushed, this action returns the following JSON:

```json
[{ "overlay": "development", "namespace": "development" }]
```

This action finds a rule in order.
If no rule is matched, this action fails.

## GitHub Deployment

This action supports [GitHub Deployment](https://docs.github.com/en/rest/deployments/deployments) to receive the deployment status from an external system, such as Argo CD.

It creates a GitHub Deployment for each environment in the form of `{overlay}/{namespace}/{service}`,
if the following fields are given:

- `overlay` (in `environments`)
- `namespace` (in `environments`)
- `service` (in the inputs)

If an old deployment exists, this action deletes it and recreates new one.

This action sets `github-deployment-url` field to the output.
For example, the below inputs are given,

```yaml
- uses: quipper/monorepo-deploy-actions/environment-matrix@v1
  with:
    service: backend
    rules: |
      - pull_request:
          base: '**'
          head: '**'
        environments:
          - overlay: pr
            namespace: pr-${{ github.event.pull_request.number }}
```

this action creates a GitHub Deployment of `pr/pr-1/backend` and returns the following JSON:

```json
[
  {
    "overlay": "pr",
    "namespace": "pr-1",
    "github-deployment-url": "https://api.github.com/repos/octocat/example/deployments/1"
  }
]
```

## Example

Here is the workflow of matrix jobs.

```yaml
jobs:
  environment-matrix:
    runs-on: ubuntu-latest
    outputs:
      environments: ${{ steps.environment-matrix.outputs.json }}
    steps:
      - uses: quipper/monorepo-deploy-actions/environment-matrix@v1
        id: environment-matrix
        with:
          service: example
          rules: |
            - pull_request:
                base: '**'
                head: '**'
              environments:
                - overlay: pr
                  namespace: pr-${{ github.event.pull_request.number }}
            - push:
                ref: refs/heads/main
              environments:
                - overlay: development
                  namespace: development

  deploy:
    needs:
      - environment-matrix
    runs-on: ubuntu-latest
    timeout-minutes: 3
    strategy:
      fail-fast: true
      matrix:
        environment: ${{ fromJSON(needs.environment-matrix.outputs.environments) }}
    steps:
      - uses: quipper/monorepo-deploy-actions/git-push-service@v1
        with:
          manifests: # (omit in this example)
          overlay: ${{ matrix.environment.overlay }}
          namespace: ${{ matrix.environment.namespace }}
          service: example
          application-annotations: |
            argocd-commenter.int128.github.io/deployment-url=${{ matrix.environment.github-deployment-url }}
```

## Spec

### Inputs

| Name      | Default        | Description                                                 |
| --------- | -------------- | ----------------------------------------------------------- |
| `rules`   | (required)     | YAML string of rules                                        |
| `service` | (optional)     | Name of service to deploy. If set, create GitHub Deployment |
| `token`   | `github.token` | GitHub token, required if `service` is set                  |

The following fields are available in the rules YAML.

```yaml
- pull_request: # on pull_request event
    base: # base branch name (wildcard available)
    head: # head branch name (wildcard available)
  environments: # array of map<string, string>
- push: # on push event
    ref: refs/heads/main # ref name (wildcard available)
  environments: # array of map<string, string>
```

It supports the wildcard pattern.
See https://github.com/isaacs/minimatch for details.

### Outputs

| Name   | Description                 |
| ------ | --------------------------- |
| `json` | JSON string of environments |
