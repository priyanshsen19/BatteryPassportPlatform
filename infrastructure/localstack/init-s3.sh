#!/bin/bash
# Runs inside LocalStack once it is ready: provisions the private document bucket.
# Production uses a real, pre-provisioned AWS S3 bucket instead (see README).
set -euo pipefail

BUCKET="${AWS_S3_BUCKET:?AWS_S3_BUCKET is required}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

if awslocal s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "Bucket $BUCKET already exists"
else
  if [ "$REGION" = "us-east-1" ]; then
    awslocal s3api create-bucket --bucket "$BUCKET"
  else
    awslocal s3api create-bucket --bucket "$BUCKET" --create-bucket-configuration "LocationConstraint=$REGION"
  fi
  echo "Created bucket $BUCKET"
fi

# Keep the bucket private: files are only reachable through short-lived pre-signed URLs.
awslocal s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
