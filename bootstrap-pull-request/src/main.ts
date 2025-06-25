import * as core from '@actions/core'
import { run } from './run.js'

const main = async (): Promise<void> => {
  const outputs = await run({
    overlay: core.getInput('overlay', { required: true }),
    namespace: core.getInput('namespace', { required: true }),
    sourceRepository: core.getInput('source-repository', { required: true }),
    destinationRepository: core.getInput('destination-repository', { required: true }),
    preserveServices: core.getMultilineInput('preserve-services'),
    overrideDirectory: core.getInput('override-directory') || undefined,
    prebuiltBranch: core.getInput('prebuilt-branch', { required: true }),
    destinationRepositoryToken: core.getInput('destination-repository-token', { required: true }),
    namespaceManifest: core.getInput('namespace-manifest') || undefined,
    substituteVariables: core.getMultilineInput('substitute-variables'),
  })
  core.setOutput('services', JSON.stringify(outputs.services))
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
