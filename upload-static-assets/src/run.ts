import * as core from '@actions/core'
import * as exec from '@actions/exec'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

interface Inputs {
  bucketName: string
  bucketPrefix: string
  dockerImage: string
  dockerImagePath: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const client = new S3Client({})

  const dockerCreate = await exec.getExecOutput('docker', ['create', inputs.dockerImage])
  const containerId = dockerCreate.stdout.trim()
  await exec.exec('docker', ['cp', `${containerId}:${inputs.dockerImagePath}`, ''])

  await client.send(new PutObjectCommand({
    Bucket: inputs.bucketName,
  }))
}
