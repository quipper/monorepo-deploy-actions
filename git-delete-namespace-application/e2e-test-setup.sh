#!/bin/bash
set -o pipefail
set -eux

cd "$GITHUB_WORKSPACE"
mkdir -p monorepo-deploy-actions/staging
cd monorepo-deploy-actions/staging

date > pr-100.yaml
date > pr-101.yaml
date > pr-102.yaml

git add .
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git config user.name 'github-actions[bot]'
git commit -m "e2e-test-fixture for ${GITHUB_REF}"
git push origin "HEAD:refs/heads/${BRANCH_NAME}"
