import * as core from '@actions/core'
import { operationOf, run } from './run'

const main = async (): Promise<void> => {
  await run({
    patch: core.getInput('patch', { required: true }),
    operation: operationOf(core.getInput('operation', { required: true })),
    overlay: core.getInput('overlay', { required: true }),
    namespace: core.getInput('namespace', { required: true }),
    destinationRepository: core.getInput('destination-repository', { required: true }),
    token: core.getInput('token', { required: true }),
  })
}

main().catch((e) => core.setFailed(e instanceof Error ? e : String(e)))
