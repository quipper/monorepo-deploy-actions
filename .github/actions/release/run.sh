#!/bin/bash
set -o pipefail
set -eux

git add .
git status
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git commit -m "Release $TAG_NAME"
git tag -f "$TAG_NAME"
git push origin -f "$TAG_NAME"
