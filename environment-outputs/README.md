# environment-outputs [![environment-outputs](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/environment-outputs.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/environment-outputs.yaml)

This action generates outputs to deploy a service to the corresponding environment.

## Getting Started

Let's think about the following example:

- When a pull request is created, deploy it to `pr-NUMBER` namespace
- When `main` branch is pushed, deploy it to `development` namespace

It can be descibed as the following rules:

```yaml
- pull_request:
    base: '**'
    head: '**'
  outputs:
    overlay: pr
    namespace: pr-${{ github.event.pull_request.number }}
- push:
    ref: refs/heads/main
  outputs:
    overlay: development
    namespace: development
```

This action finds a rule matched to the current context.
If any rule is matched, this action returns the outputs corresponding to the rule.
For example, when `main` branch is pushed, this action returns the following outputs:

```yaml
overlay: development
namespace: development
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
- uses: quipper/monorepo-deploy-actions/environment-outputs@v1
  with:
    service: backend
    rules: |
      - pull_request:
          base: '**'
          head: '**'
        outputs:
          overlay: pr
          namespace: pr-${{ github.event.pull_request.number }}
```

this action creates a GitHub Deployment of `pr/pr-1/backend` and returns the following outputs:

```yaml
overlay: pr
namespace: pr-1
github-deployment-url: https://api.github.com/repos/octocat/example/deployments/1
```

## Example

Here is the example workflow.

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 3
    steps:
      - uses: quipper/monorepo-deploy-actions/environment-outputs@v1
        id: environment
        with:
          service: example
          rules: |
            - pull_request:
                base: '**'
                head: '**'
              outputs:
                overlay: pr
                namespace: pr-${{ github.event.pull_request.number }}
            - push:
                ref: refs/heads/main
              outputs:
                overlay: development
                namespace: development
      - uses: quipper/monorepo-deploy-actions/git-push-service@v1
        with:
          manifests: # (omit in this example)
          overlay: ${{ steps.environment.outputs.overlay }}
          namespace: ${{ steps.environment.outputs.namespace }}
          service: example
          application-annotations: |
            argocd-commenter.int128.github.io/deployment-url=${{ steps.environment.outputs.github-deployment-url }}
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
  outputs: # map<string, string>
- push: # on push event
    ref: refs/heads/main # ref name (wildcard available)
  outputs: # map<string, string>
```

It supports the wildcard pattern.
See https://github.com/isaacs/minimatch for details.

### Outputs

This actions returns the outputs corresponding to the rule.

It also returns the below outputs.

| Name                    | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| `github-deployment-url` | URL of GitHub Deployment. Available if `service` is set in the inputs |
