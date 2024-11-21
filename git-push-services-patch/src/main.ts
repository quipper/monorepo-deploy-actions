import * as core from '@actions/core'
import { operationOf, run } from './run.js'

const main = async (): Promise<void> => {
  await run({
    patch: core.getInput('patch', { required: true }),
    operation: operationOf(core.getInput('operation', { required: true })),
    overlay: core.getInput('overlay', { required: true }),
    namespace: core.getInput('namespace', { required: true }),
    services: core.getMultilineInput('services'),
    excludeServices: core.getMultilineInput('exclude-services'),
    destinationRepository: core.getInput('destination-repository', { required: true }),
    token: core.getInput('token', { required: true }),
  })
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
