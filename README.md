# monorepo-deploy-actions

This is a set of GitHub Actions to deploy microservices in a mono-repository (monorepo).


## Actions

| Name | Description | Status
|------|-------------|-------
| [resolve-aws-secret-version](resolve-aws-secret-version) | Resolve AWSSecret versionId placeholders in a manifest | [![resolve-aws-secret-version](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/resolve-aws-secret-version.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/resolve-aws-secret-version.yaml)
| [substitute](substitute) | Substitute variables in manifests | [![substitute](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/substitute.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/substitute.yaml)
| [git-push-service](git-push-service) | Push an Argo CD Application with generated manifest for service | [![git-push-service](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-service.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-service.yaml)
| [git-push-namespace](git-push-namespace) | Push an Argo CD Application for namespace | [![git-push-namespace](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-namespace.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-namespace.yaml)
| [git-delete-namespace-application](git-delete-namespace-application) | Delete Argo CD Applications of pull request namespaces | [![git-delete-namespace-application](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-application.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-application.yaml)
| [git-delete-namespace-branch](git-delete-namespace-branch) | Delete branches of pull request namespaces | [![git-delete-namespace-branch](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-branch.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-branch.yaml)


## Release strategy

When you merge a pull request into `main` branch, the workflow will release it to a release tag (such as `v1`, defined in [`release` workflow](.github/workflows/release.yaml)).
A release tag is shipped with `dist` files.
`main` branch is not for production because it does not contain `dist` files.
