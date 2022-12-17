# environment-matrix [![environment-matrix](https://github.com/int128/typescript-actions-monorepo/actions/workflows/environment-matrix.yaml/badge.svg)](https://github.com/int128/typescript-actions-monorepo/actions/workflows/environment-matrix.yaml)

This action generates a JSON string to deploy a service to environments by the matrix job.

## Getting Started

Let's think about the following requirements:

- When a pull request is created, deploy it to `pr-NUMBER` namespace
- When `main` branch is pushed, deploy it to `development` namespace

Here is an example workflow.

```yaml
jobs:
  environment-matrix:
    runs-on: ubuntu-latest
    outputs:
      environments: ${{ steps.environment-matrix.outputs.json }}
    steps:
      - uses: int128/typescript-actions-monorepo/environment-matrix@v1
        id: environment-matrix
        with:
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
          service: # (omit in this example)
```

This action finds a rule matched to the current context.
If any rule is matched, this action returns a JSON string of `environments` field of the rule.
For example, when `main` branch is pushed, this action returns the following JSON:

```json
[{"overlay": "development", "namespace": "development"}]
```

This action finds a rule in order.
If no rule is matched, this action fails.

## Spec

### Inputs

| Name | Type | Description
|------|----------|---------
| `rules` | `string` | YAML string of rules

The following fields are available in the rules YAML.

```yaml
- pull_request: # on pull_request event
    base:       # base branch name (wildcard available)
    head:       # head branch name (wildcard available)
  environments: # array of map<string, string>
- push:                   # on push event
    ref: refs/heads/main  # ref name (wildcard available)
  environments:           # array of map<string, string>
```

It supports the wildcard pattern.
See https://github.com/isaacs/minimatch for details.

### Outputs

| Name | Description
|------|------------
| `json` | JSON string of environments
