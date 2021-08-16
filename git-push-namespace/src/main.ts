import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  await run({
    overlay: core.getInput('overlay', { required: true }),
    namespace: core.getInput('namespace', { required: true }),
    destinationRepository: core.getInput('destination-repository', { required: true }),
    destinationBranch: core.getInput('destination-branch', { required: true }),
    token: core.getInput('token', { required: true }),
  })
}

main().catch((error) => core.setFailed(error))
