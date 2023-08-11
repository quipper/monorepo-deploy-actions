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

This action deletes the Application manifests in the destination repository.
It assumes the following directory layout:

```
.
└── ${project}
    └── ${overlay}
        └── ${namespace-prefix}-${number}.yaml
```

For example,

```
.
└── monorepo
    └── pr
        ├── .keep
        ├── pr-100.yaml
        ├── pr-101.yaml
        └── pr-102.yaml
```

If a filename ends with `retain-pull-request-numbers`, this action does not delete it.
For example, `retain-pull-request-numbers: 100` is given, this action does not delete `pr-100.yaml`.

### .keep is required

You need to add `${project}/${overlay}/.keep` into the destination directory.
This action fails if the directory `${project}/${overlay}` does not exist.
It is by design to notice a problem.

### Use-case: nightly stop

To delete the applications of pull requests except those with `skip-nightly-stop` label:

```yaml
on:
  schedule:
    - cron: '0 22 * * *'  # change to your timezone

jobs:
  delete-applications:
    runs-on: ubuntu-latest
    steps:
      - name: List pull requests to retain
        id: list-retain
        uses: actions/github-script@v6
        with:
          retries: 3
          result-encoding: string
          script: |
            const issues = await github.paginate(github.rest.issues.listForRepo, {
              owner: context.repo.owner,
              repo: context.repo.repo,
              state: 'open',
              labels: 'skip-nightly-stop',
              per_page: 100,
            })
            const pulls = issues.filter((i) => i.pull_request)
            core.info(`response = ${JSON.stringify(pulls, undefined, 2)}`)
            return pulls.map((pull) => pull.number).join('\n')

      # Delete Argo CD applications except labeled pull requests.
      # Don't delete branches so that we can shortly redeploy a pull request
      - uses: quipper/monorepo-deploy-actions/git-delete-namespace-application@v1
        id: delete
        with:
          retain-pull-request-numbers: ${{ steps.list-retain.outputs.result }}
          overlay: staging
          namespace-prefix: pr-

      # Notify comments
      - uses: int128/issues-action@v2
        with:
          issue-numbers: ${{ steps.delete.outputs.deleted-pull-request-numbers }}
          remove-labels: deploy
          post-comment: |
            :zzz: Pull request namespace has been stopped.
```
