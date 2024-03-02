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

| Name                     | Description                             | Example                 |
| ------------------------ | --------------------------------------- | ----------------------- |
| `source-repository-name` | name of source repository               | `monorepo`              |
| `overlay`                | name of overlay to build with Kustomize | `staging`               |
| `namespace`              | namespace to deploy into a cluster      | `pr-12345`              |
| `service`                | name of microservice                    | `backend` or `frontend` |

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

## Development

Node.js and pnpm is required.

```sh
brew install node@20
corepack enable pnpm
```

### Release workflow

When a pull request is merged into main branch, a new minor release is created by GitHub Actions.
See https://github.com/int128/release-typescript-action for details.

### Dependency update

You can enable Renovate to update the dependencies.
See https://github.com/int128/typescript-action-renovate-config for details.
