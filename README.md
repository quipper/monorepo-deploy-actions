# monorepo-deploy-actions

This is a collection of GitHub Actions to deploy monorepo Microservices in GitOps way.


## Actions

| Name | Description | Status
|------|-------------|-------
| [hello-world](hello-world) | Hello World | [![hello-world](https://github.com/int128/typescript-actions-monorepo/actions/workflows/hello-world.yaml/badge.svg)](https://github.com/int128/typescript-actions-monorepo/actions/workflows/hello-world.yaml)


## Release strategy

When you merge a pull request into `main` branch, the workflow will release it to a release tag (such as `v1`, defined in [`release` workflow](.github/workflows/release.yaml)).
A release tag is shipped with `dist` files.
`main` branch is not for production because it does not contain `dist` files.

This brings the following advantages:

- It prevents conflict of `dist` files in a pull request
- It reduces diff in a pull request
- It does not interrupt Renovate automation
