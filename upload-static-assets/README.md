# hello-world [![hello-world](https://github.com/int128/typescript-actions-monorepo/actions/workflows/hello-world.yaml/badge.svg)](https://github.com/int128/typescript-actions-monorepo/actions/workflows/hello-world.yaml)

This is a template of TypeScript Action.


## Getting Started

To run this action:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: int128/typescript-actions-monorepo/hello-world@v1
        with:
          name: hello
```


## Inputs

| Name | Required | Default | Description
|------|----------|---------|------------
| `name` | `true` | - | example input


## Outputs

| Name | Description
|------|------------
| `example` | example output
