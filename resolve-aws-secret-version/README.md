# resolve-aws-secret-version

This is an action to resolve the secret versions of manifests.
It supports the following operators:

- `AWSSecret` resource of https://github.com/mumoshu/aws-secret-operator
- `ExternalSecret` resource of https://github.com/external-secrets/external-secrets

## Inputs

| Name        | Type             | Description                    |
| ----------- | ---------------- | ------------------------------ |
| `manifests` | Multiline string | Glob pattern(s) to manifest(s) |

## Example

Here is an example workflow:

```yaml
steps:
  - uses: int128/kustomize-action@v1
    id: kustomize
    with:
      kustomization: path/to/kustomization.yaml
  - uses: quipper/monorepo-deploy-actions/resolve-aws-secret-version@v1
    id: resolve-secret
    with:
      manifests: ${{ steps.kustomize.outputs.directory }}/**/*.yaml
```

If no manifest file is matched, this action does nothing.

When the below manifest is given,

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: microservice
spec:
  template:
    spec:
      containers:
        - image: nginx
          envFrom:
            - secretRef:
                name: microservice-${AWS_SECRETS_MANAGER_VERSION_ID}
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: microservice-${AWS_SECRETS_MANAGER_VERSION_ID}
spec:
  dataFrom:
    - extract:
        key: microservice/develop
        version: uuid/${AWS_SECRETS_MANAGER_VERSION_ID}
```

This action replaces a placeholder in `version` field with the current version ID.
In this example, it replaces `${AWS_SECRETS_MANAGER_VERSION_ID}` with the current version ID.

This action replaces the placeholders by the following rules:

- If a manifest does not contain any `ExternalSecret` or `AWSSecret`, do nothing.
- It replaces the placeholder if `version` field of `ExternalSecret` has a placeholder in form of `uuid/${...}`.
- It replaces the placeholder if `versionId` field of `AWSSecret` has a placeholder in form of `${...}`.

Finally this action writes the below manifest:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: microservice
spec:
  template:
    spec:
      containers:
        - image: nginx
          envFrom:
            - secretRef:
                name: microservice-c7ea50c5-b2be-4970-bf90-2237bef3b4cf
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: microservice-c7ea50c5-b2be-4970-bf90-2237bef3b4cf
spec:
  dataFrom:
    - extract:
        key: microservice/develop
        version: uuid/c7ea50c5-b2be-4970-bf90-2237bef3b4cf
```

This action accepts multi-line paths.
If 2 or more manifests are given, this action processes them and sets the output paths as a multi-line string.
