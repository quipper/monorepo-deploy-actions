# template [![template](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/template.yaml/badge.svg)](https://github.com/quipper/monorepo-deploy-actions/actions/workflows/template.yaml)

This is an action to...

## Getting Started

To run this action:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: quipper/monorepo-deploy-actions/template@v1
        with:
          name: hello
```

## Inputs

| Name   | Default    | Description   |
| ------ | ---------- | ------------- |
| `name` | (required) | example input |

## Outputs

| Name      | Description    |
| --------- | -------------- |
| `example` | example output |
