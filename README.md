# monorepo-deploy-actions

This is a set of GitHub Actions to deploy microservices in a mono-repository (monorepo).


## Motivation

TODO


## Concept

### Structure of monorepo

In Quipper, our monorepo contains a set of microservices with Kubernetes manifests, for example,

```
monorepo
├── backend
|   ├── sources...
|   └── kubernetes
|       ├── base
|       └── overlays
|           ├── develop
|           |   └── kustomization.yaml
|           └── staging
|               └── kustomization.yaml
├── frontend
|   ├── sources...
|   └── kubernetes
|       └── overlays
|           └── ...
└── ...
```

We adopt this strcuture for the following advantages:

- An owner of microservice (i.e. product team) has strong ownership for both application and manifest
- We can change both application and manifest in a pull request

We deploy a set of services from a branch to a namespace.
For example,

- When `develop` branch is pushed,
    - Build a Docker image from `develop` branch
    - Run kustomize build against `develop` overlay
    - Deploy to `develop` namespace
- When a pull request is created,
    - Build a Docker image from head branch
    - Run kustomize build against `staging` overlay
    - Deploy to an ephemeral namespace like `pr-12345`

Consequently, a structure of monorepo is like below.

```
monorepo
└── ${service}
    └── kubernetes
        └── overlays
            └── ${overlay}
                └── kustomization.yaml
```


### Structure of Argo CD Applications

We adopt [App of Apps pattern of Argo CD](https://argoproj.github.io/argo-cd/operator-manual/cluster-bootstrapping/) for deployment hierarchy.
To deploy multiple microservices (which are built from an overlay) to a namespace, we creates the following applications into Argo CD:

```
${source-repository-name}  (Application)
└── ${overlay}  (Application)
    └── ${namespace}  (Application)
        └── ${service}  (Application)
```

Here are the definitions of words.

Name | Description | Example
-----|-------------|--------
`source-repository-name` | name of source repository | `monorepo`
`overlay` | name of overlay to build with Kustomize | `staging`
`namespace` | namespace to deploy into a cluster | `pr-12345`
`service` | name of microservice | `backend` or `frontend`


### Destination repository

We stores generated manifests into a repository.
Argo CD syncs between the repository and cluster.

main branch of the repository contains Application manifests.

```
destination-repository  (branch: main)
└── ${source-repository-name}
    └── ${overlay}
        └── ${namespace}.yaml  (Application)
```

A namespace branch contains a set of generated manifest and Application manifest per a service.

```
destination-repository  (branch: ns/${source-repository}/${overlay}/${namespace})
├── applications
|   └── ${namespace}--${service}.yaml  (Application)
└── services
    └── ${service}
        └── generated.yaml
```



## Actions

| Name | Description | Status
|------|-------------|-------
| [resolve-aws-secret-version](resolve-aws-secret-version) | Resolve AWSSecret versionId placeholders in a manifest | [![resolve-aws-secret-version](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/resolve-aws-secret-version.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/resolve-aws-secret-version.yaml)
| [substitute](substitute) | Substitute variables in manifests | [![substitute](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/substitute.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/substitute.yaml)
| [git-push-service](git-push-service) | Push an Argo CD Application with generated manifest for service | [![git-push-service](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-service.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-service.yaml)
| [git-push-services-from-prebuilt](git-push-services-from-prebuilt) | Push an Argo CD Application with generated manifest from prebuilt manifests | [![git-push-services-from-prebuilt](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-services-from-prebuilt.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-services-from-prebuilt.yaml)
| [git-push-namespace](git-push-namespace) | Push an Argo CD Application for namespace | [![git-push-namespace](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-namespace.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-namespace.yaml)
| [git-delete-namespace-application](git-delete-namespace-application) | Delete Argo CD Applications of pull request namespaces | [![git-delete-namespace-application](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-application.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-application.yaml)
| [git-delete-namespace-branch](git-delete-namespace-branch) | Delete branches of pull request namespaces | [![git-delete-namespace-branch](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-branch.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-branch.yaml)
| [open-backport-pull-request](open-backport-pull-request) | Open Backport Pull Requests from a specific branch | [![open-backport-pull-request](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/open-backport-pull-request.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/open-backport-pull-request.yaml)


## Development

### Release workflow

When a pull request is merged into main branch, a new minor release is created by GitHub Actions.
See https://github.com/int128/release-typescript-action for details.

### Dependency update

You can enable Renovate to update the dependencies.
See https://github.com/int128/typescript-action-renovate-config for details.
