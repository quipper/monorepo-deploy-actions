# git-delete-namespace-branch

This is an action to delete branch(es) corresponding to namespace(s).

## DEPRECATED :warning:

Use [cleanup-closed-pull-requests](../cleanup-closed-pull-requests) instead.

## Inputs

| Name                          | Type             | Description                                             |
| ----------------------------- | ---------------- | ------------------------------------------------------- |
| `retain-pull-request-numbers` | multiline string | List of pull request number(s) to retain                |
| `namespace-prefix`            | string           | Prefix of namespace                                     |
| `overlay`                     | string           | Name of overlay                                         |
| `destination-repository`      | string           | Destination repository                                  |
| `token`                       | string           | GitHub token (default to `github.token`)                |
| `dry-run`                     | boolean          | Do not delete manifest(s) actually (default to `false`) |

## Getting Started

### Clean up closed pull requests

To delete branches of closed pull requests:

```yaml
steps:
  - name: List open pull requests
    id: list-open
    uses: actions/github-script@v4
    with:
      result-encoding: string
      script: |
        const response = await github.graphql(`
          query ($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
              pullRequests(states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}, first: 50) {
                nodes {
                  number
                }
              }
            }
          }
        `, {
          owner: context.repo.owner,
          name: context.repo.repo,
        })
        core.info(`response = ${JSON.stringify(response, undefined, 2)}`)
        return response.repository.pullRequests.nodes.map((e) => e.number).join('\n')
  - uses: quipper/monorepo-deploy-actions/git-delete-namespace-branch@v1
    with:
      retain-pull-request-numbers: ${{ steps.list-open.outputs.result }}
      namespace-prefix: pr-
      overlay: staging
```
