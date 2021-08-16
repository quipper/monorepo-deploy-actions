import * as core from '@actions/core'
import { run } from './run'

async function main(): Promise<void> {
  const inputs = {
    manifests: core.getInput('manifests', { required: true }),
    writeInPlace: core.getBooleanInput('write-in-place', { required: true }),
  }
  const outputs = await run(inputs)
  core.setOutput('path', outputs.manifestPaths.join('\n'))
}

main().catch((error) => core.setFailed(error))
