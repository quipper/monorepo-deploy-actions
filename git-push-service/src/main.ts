import * as core from '@actions/core'
import { run } from '../src/run'

async function main(): Promise<void> {
  await run({
    manifests: core.getInput('manifests', { required: true }),
    manifestsPattern: core.getInput('manifests-pattern', { required: true }),
    overlay: core.getInput('overlay', { required: true }),
    namespace: core.getInput('namespace', { required: true }),
    destinationRepository: core.getInput('destination-repository', { required: true }),
    overwrite: core.getBooleanInput('overwrite', { required: true }),
    token: core.getInput('token', { required: true }),
  })
}

main().catch((error) => core.setFailed(error))
