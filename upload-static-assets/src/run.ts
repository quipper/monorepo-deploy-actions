import * as core from '@actions/core'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

interface Inputs {
  bucketName: string
  bucketPrefix: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const client = new S3Client({})

  await client.send(new PutObjectCommand({
    Bucket: inputs.bucketName,
  }))
}
