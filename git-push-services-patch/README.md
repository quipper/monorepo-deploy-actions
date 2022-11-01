# git-push-services-patch

This is an action to push a patch to all services in a namespace.

## Inputs

Name | Type | Description
-----|------|------------
`patch` | string | Path to a patch
`operation` | string | Either `add` or `delete`
`overlay` | string | Name of overlay
`namespace` | string | Name of namespace
`destination-repository` | string | Destination repository
`token` | string | GitHub token (default to `github.token`)

## Outputs

Nothing.

## Use-case: nightly stop

For cost saving, we can temporarily stop all pods in night.

Here is an example of workflow.

```yaml
name: scale-in-pods-daily

on:
  schedule:
    - cron: '0 13 * * 1-5' # 22:00 JST weekday

jobs:
  namespaces:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v3
      - uses: quipper/monorepo-deploy-actions/git-push-services-patch@v1
        with:
          patch: nightly-stop-patch/kustomization.yaml
          operation: add
          overlay: develop
          namespace: develop
```

You need create a patch such as [this example of kustomization.yaml](tests/fixtures/kustomization.yaml).

When the workflow runs, this action pushes the patch into the all services in destination repository.

```
destination-repository (branch: ns/${project}/${overlay}/${namespace})
├── applications
└── services
    └── ${service}
        ├── generated.yaml
        └── kustomization.yaml
```

For scale-out, you can delete the patch as follows:

```yaml
      - uses: quipper/monorepo-deploy-actions/git-push-services-patch@v1
        with:
          patch: nightly-stop-patch/kustomization.yaml
          operation: delete
```
