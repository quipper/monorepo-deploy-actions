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
    - outputs:
        overlay: pr
        namespace: pr-${{ github.event.pull_request.number }}
- push:
    ref: refs/heads/main
  environments:
    - outputs:
        overlay: development
        namespace: development
```

This action finds a rule matched to the current context.
If any rule is matched, this action returns a JSON string of `outputs` field of the rule.
For example, when `main` branch is pushed, this action returns the following JSON:

```json
[{ "overlay": "development", "namespace": "development" }]
```

This action finds a rule in order.
If no rule is matched, this action fails.

### GitHub Deployment

This action supports [GitHub Deployment](https://docs.github.com/en/rest/deployments/deployments) to receive the deployment status from an external system, such as Argo CD.

If a rule has `github-deployment` field, this action creates a GitHub Deployment for the environment.

If an old deployment exists, this action deletes it and recreates new one.

This action sets `github-deployment-url` field to the output.
For example, the below inputs are given,

```yaml
- uses: quipper/monorepo-deploy-actions/environment-matrix@v1
  with:
    rules: |
      - pull_request:
          base: '**'
          head: '**'
        environments:
          - outputs:
              overlay: pr
              namespace: pr-${{ github.event.pull_request.number }}
            github-deployment:
              environment: pr/pr-${{ github.event.pull_request.number }}/backend
```

This action creates a GitHub Deployment of `pr/pr-1/backend` and returns the following JSON:

```json
[
  {
    "overlay": "pr",
    "namespace": "pr-1",
    "github-deployment-url": "https://api.github.com/repos/octocat/example/deployments/1"
  }
]
```

### Conditional deployment

If an environment has `if-file-exists` field, this action checks if the glob pattern matches any files in the working directory.
For example, the below inputs are given,

```yaml
- uses: quipper/monorepo-deploy-actions/environment-matrix@v1
  with:
    rules: |
      - pull_request:
          base: '**'
          head: '**'
        environments:
          - if-file-exists: |
              backend/kubernetes/overlays/pr/kustomization.yaml
            outputs:
              overlay: pr
              namespace: pr-${{ github.event.pull_request.number }}
```

This action returns the following JSON if `backend/kubernetes/overlays/pr/kustomization.yaml` exists:

```json
[{ "overlay": "pr", "namespace": "pr-1" }]
```

It returns an empty array if the file does not exist.

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
                - outputs:
                    overlay: pr
                    namespace: pr-${{ github.event.pull_request.number }}
            - push:
                ref: refs/heads/main
              environments:
                - outputs:
                    overlay: development
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

| Name    | Default        | Description                                            |
| ------- | -------------- | ------------------------------------------------------ |
| `rules` | (required)     | YAML string of rules                                   |
| `token` | `github.token` | GitHub token, required if creating a GitHub deployment |

The following fields are available in the rules YAML.

```yaml
- pull_request: # Conditions for pull_request events
    base: # A glob pattern of base branch
    head: # A glob pattern of head branch
  environments: # Environments evaluated when the conditions match
    - outputs:
        key: value # Key-value pairs of outputs to return
      github-deployment: # If set, create a GitHub deployment for this environment
        environment: pr-1 # The name of the environment
- push: # Conditions for push events
    ref: refs/heads/main # A glob pattern of ref
  environments: []
```

For details, see the type definition in [src/rule.ts](src/rule.ts).

### Outputs

| Name   | Description                 |
| ------ | --------------------------- |
| `json` | JSON string of environments |
