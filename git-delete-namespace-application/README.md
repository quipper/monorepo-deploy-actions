# git-delete-namespace-application

This is an action to delete manifest(s) of Argo CD `Application`.

## Inputs

| Name                          | Type             | Description                                             |
| ----------------------------- | ---------------- | ------------------------------------------------------- |
| `retain-pull-request-numbers` | multiline string | List of pull request number(s) to retain                |
| `namespace-prefix`            | string           | Prefix of namespace                                     |
| `overlay`                     | string           | Name of overlay                                         |
| `destination-repository`      | string           | Destination repository                                  |
| `destination-branch`          | string           | Destination branch (default to `main`)                  |
| `token`                       | string           | GitHub token (default to `github.token`)                |
| `dry-run`                     | boolean          | Do not delete manifest(s) actually (default to `false`) |

## Getting Started

To stop pull request(s) except those with `deploy/keep` label:

```yaml
steps:
  - name: List pull requests to retain
    id: list-retain
    uses: actions/github-script@v4
    with:
      result-encoding: string
      script: |
        const response = await github.graphql(`
          query ($owner: String!, $name: String!, $labels: [String!]) {
            repository(owner: $owner, name: $name) {
              pullRequests(states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}, labels: $labels, first: 50) {
                nodes {
                  number
                }
              }
            }
          }
        `, {
          owner: context.repo.owner,
          name: context.repo.repo,
          labels: ['deploy/keep'],
        })
        core.info(`response = ${JSON.stringify(response, undefined, 2)}`)
        return response.repository.pullRequests.nodes.map((e) => e.number).join('\n')
  - uses: quipper/monorepo-deploy-actions/git-delete-namespace-application@v1
    with:
      retain-pull-request-numbers: ${{ steps.list-retain.outputs.result }}
      namespace-prefix: pr-
      overlay: staging
```

This action deletes `Application` manifest(s) in the destination repository.
