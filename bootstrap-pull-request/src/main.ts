import * as core from '@actions/core'
import { run } from './run.js'

const main = async (): Promise<void> => {
  const outputs = await run({
    overlay: core.getInput('overlay', { required: true }),
    namespace: core.getInput('namespace', { required: true }),
    sourceRepository: core.getInput('source-repository', { required: true }),
    destinationRepository: core.getInput('destination-repository', { required: true }),
    preserveServices: core.getMultilineInput('preserve-services'),
    prebuiltBranch: core.getInput('prebuilt-branch', { required: true }),
    overridePrebuiltBranch: core.getInput('override-prebuilt-branch') || undefined,
    overrideServices: core.getMultilineInput('override-services'),
    destinationRepositoryToken: core.getInput('destination-repository-token', { required: true }),
    substituteVariables: core.getMultilineInput('substitute-variables'),
  })
  core.setOutput('services', JSON.stringify(outputs.services))
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
