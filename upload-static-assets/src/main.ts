import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  await run({
    bucketName: core.getInput('bucket-name', { required: true }),
    bucketPrefix: core.getInput('bucket-prefix', { required: true }),
    dockerImage: core.getInput('docker-image', { required: true }),
    dockerImagePath: core.getInput('docker-image-path', { required: true }),
  })
}

main().catch((e) => core.setFailed(e instanceof Error ? e.message : JSON.stringify(e)))
