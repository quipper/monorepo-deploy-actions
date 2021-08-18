# monorepo-deploy-actions

This is a set of GitHub Actions to deploy microservices in a mono-repository (monorepo).


## Motivation

TODO


## Design

### Concept

This assumes that a monorepo contains a set of microservices including Kubernetes manifests, for example,

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

We deploy a set of services from a branch to a namespace.
For example,

- `develop` branch is deployed using `develop` overlay to `develop` namespace
- A pull request is deployed using `staging` overlay to an ephemeral namespace like `pr-12345`

Consequently, a structure of monorepo is below.

```
monorepo
└── ${service}
    └── kubernetes
        └── overlays
            └── ${overlay}
                └── kustomization.yaml
```

Glossary:

- `overlay` represents a manifest to deploy to namespace(s), e.g. `staging`
- `namespace` represents a namespace in Kubernetes cluster
- `service` represents a name of microservice, e.g., `backend` or `frontend`


### Destination repository

This stores a set of generated manifests into a repository.

It adopts [App of Apps pattern of Argo CD](https://argoproj.github.io/argo-cd/operator-manual/cluster-bootstrapping/) for deployment of multiple namespaces:

```
${source-repository-name}  (Application)
└── ${overlay}  (Application)
    └── ${namespace}  (Application)
        └── ${service}  (Application)
```

It stores an Application manifest to a destination repository as follows:

```
destination-repository  (branch: main)
└── ${source-repository-name}
    └── ${overlay}
        └── ${namespace}.yaml  (Application)
```

It also stores a set of generated manifest and Application manifest per a service as follows:

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
| [git-push-service](git-push-service) | Push manifests to deploy services | [![git-push-service](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-service.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-service.yaml)
| [git-push-namespace](git-push-namespace) | Push an Argo CD Application for namespace | [![git-push-namespace](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-namespace.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-push-namespace.yaml)
| [git-delete-namespace-application](git-delete-namespace-application) | Delete Argo CD Applications of pull request namespaces | [![git-delete-namespace-application](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-application.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-application.yaml)
| [git-delete-namespace-branch](git-delete-namespace-branch) | Delete branches of pull request namespaces | [![git-delete-namespace-branch](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-branch.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/git-delete-namespace-branch.yaml)


## Release strategy

When you merge a pull request into `main` branch, the workflow will release it to a release tag (such as `v1`, defined in [`release` workflow](.github/workflows/release.yaml)).
A release tag is shipped with `dist` files.
`main` branch is not for production because it does not contain `dist` files.
