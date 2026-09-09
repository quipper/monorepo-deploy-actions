#/bin/bash
set -o pipefail
set -eux

content_dir="$(mktemp -d)"
container_id="$(docker create "$SOURCE_IMAGE")"
docker cp "$container_id:$SOURCE_PATH" "$content_dir"
docker rm "$container_id"

find "$content_dir" -type f

docker run --rm amazon/aws-cli:latest --version
docker run --rm \
  -v /tmp:/tmp \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  -e AWS_SESSION_TOKEN \
  amazon/aws-cli:latest \
  s3 sync --no-progress "$content_dir" "$BUCKET_URI"
