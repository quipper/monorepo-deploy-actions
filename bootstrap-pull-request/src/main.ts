import * as core from '@actions/core'
import { run } from './run.js'

const main = async (): Promise<void> => {
  await run({
    overlay: core.getInput('overlay', { required: true }),
    namespace: core.getInput('namespace', { required: true }),
    sourceRepository: core.getInput('source-repository', { required: true }),
    destinationRepository: core.getInput('destination-repository', { required: true }),
    destinationRepositoryToken: core.getInput('destination-repository-token', { required: true }),
    namespaceManifest: core.getInput('namespace-manifest') || undefined,
    substituteVariables: core.getMultilineInput('substitute-variables'),
  })
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
