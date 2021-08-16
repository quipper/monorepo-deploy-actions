# resolve-aws-secret-version

This is an action to resolve version IDs of `AWSSecret` in a manifest.
It is designed for https://github.com/mumoshu/aws-secret-operator.


## Inputs

Name | Type | Description
-----|------|------------
`manifests` | multiline string | Glob pattern(s) to manifest(s)
`write-in-place` | boolean | Default to `true`. If set to `false`, this action writes a resolved manifest to a temporary file


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

When the below manifest is given,

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-service
spec:
  template:
    spec:
      containers:
        - image: nginx
          envFrom:
            - secretRef:
                name: my-service-${AWS_SECRETS_MANAGER_VERSION_ID}
---
apiVersion: mumoshu.github.io/v1alpha1
kind: AWSSecret
metadata:
  name: my-service-${AWS_SECRETS_MANAGER_VERSION_ID}
spec:
  stringDataFrom:
    secretsManagerSecretRef:
      secretId: my-service/develop
      versionId: ${AWS_SECRETS_MANAGER_VERSION_ID}
```

This action replaces a placeholder in `versionId` field with the current version ID.
In this example, it replaces `${AWS_SECRETS_MANAGER_VERSION_ID}` with the current one.

Here are some rules:

- If a manifest does not contain any `AWSSecret`, do nothing
- If `versionId` field is not placeholder in form of `${...}`, it is ignored

Finally this action writes the below manifest to a temporary file:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-service
spec:
  template:
    spec:
      containers:
        - image: nginx
          envFrom:
            - secretRef:
                name: my-service-c7ea50c5-b2be-4970-bf90-2237bef3b4cf
---
apiVersion: mumoshu.github.io/v1alpha1
kind: AWSSecret
metadata:
  name: my-service-c7ea50c5-b2be-4970-bf90-2237bef3b4cf
spec:
  stringDataFrom:
    secretsManagerSecretRef:
      secretId: my-service/develop
      versionId: c7ea50c5-b2be-4970-bf90-2237bef3b4cf
```

This action accepts multi-line paths.
If 2 or more manifests are given, this action processes them and sets the output paths as a multi-line string.
