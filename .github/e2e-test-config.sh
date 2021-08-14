#!/bin/bash
set -o pipefail
set -eux

if [[ $GITHUB_EVENT_NAME == pull_request ]]; then
  echo "::set-output name=namespace::${GITHUB_REF//\//-}"
  echo "::set-output name=overlay::staging"
  exit 0
fi

if [[ $GITHUB_EVENT_NAME == push && $GITHUB_REF == refs/heads/main ]]; then
  echo "::set-output name=namespace::push-$GITHUB_RUN_ID"
  echo "::set-output name=overlay::main"
  exit 0
fi

: unknown trigger
exit 1
