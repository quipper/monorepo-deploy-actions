import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  await run({
    prebuiltDirectory: core.getInput('prebuilt-directory', { required: true }),
    overlay: core.getInput('overlay', { required: true }),
    namespace: core.getInput('namespace', { required: true }),
    destinationRepository: core.getInput('destination-repository', { required: true }),
    token: core.getInput('token', { required: true }),
  })
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
