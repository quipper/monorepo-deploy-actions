import * as core from '@actions/core'
import { run } from '../src/run'

async function main(): Promise<void> {
  await run({
    manifests: core.getInput('manifests', { required: true }),
    overlay: core.getInput('overlay', { required: true }),
    namespace: core.getInput('namespace', { required: true }),
    service: core.getInput('service', { required: true }),
    namespaceLevel: core.getBooleanInput('namespace-level', { required: true }),
    applicationAnnotations: core.getMultilineInput('application-annotations'),
    destinationRepository: core.getInput('destination-repository', { required: true }),
    prebuilt: core.getBooleanInput('prebuilt', { required: true }),
    token: core.getInput('token', { required: true }),
  })
}

main().catch((e) => core.setFailed(e instanceof Error ? e.message : JSON.stringify(e)))
