import * as core from '@actions/core'
import { run } from './run.js'

const main = async () => {
  const inputs = {
    manifests: core.getInput('manifests'),
  }
  await run(inputs)
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
