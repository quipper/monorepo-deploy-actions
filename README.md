# monorepo-deploy-actions

This is a collection of GitHub Actions to deploy monorepo Microservices in GitOps way.


## Actions

| Name | Description | Status
|------|-------------|-------
| [resolve-aws-secret-version](resolve-aws-secret-version) | Resolve AWSSecret versionId placeholders in a manifest | [![resolve-aws-secret-version](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/resolve-aws-secret-version.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/resolve-aws-secret-version.yaml)
| [substitute](substitute) | Substitute variable(s) in manifest(s) | [![substitute](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/substitute.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/substitute.yaml)
| [git-push-service](git-push-service) | Push manifest(s) to deploy service(s) | [![git-push-service](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-service.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-service.yaml)
| [git-push-namespace](git-push-namespace) | Push manifest(s) to deploy service(s) | [![git-push-namespace](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-namespace.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-namespace.yaml)
| [git-delete-namespace-application](git-delete-namespace-application) | Push manifest(s) to deploy service(s) | [![git-delete-namespace-application](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-application.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-application.yaml)
| [git-delete-namespace-branch](git-delete-namespace-branch) | Push manifest(s) to deploy service(s) | [![git-delete-namespace-branch](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-branch.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-branch.yaml)


## Release strategy

When you merge a pull request into `main` branch, the workflow will release it to a release tag (such as `v1`, defined in [`release` workflow](.github/workflows/release.yaml)).
A release tag is shipped with `dist` files.
`main` branch is not for production because it does not contain `dist` files.

This brings the following advantages:

- It prevents conflict of `dist` files in a pull request
- It reduces diff in a pull request
- It does not interrupt Renovate automation
