#!/bin/bash
set -o pipefail
set -eux

git push origin "HEAD:refs/heads/${BRANCH_NAME}"
