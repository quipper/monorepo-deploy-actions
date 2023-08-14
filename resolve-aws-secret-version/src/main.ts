import * as core from '@actions/core'
import { run } from './run'

async function main(): Promise<void> {
  const inputs = {
    manifests: core.getInput('manifests', { required: true }),
  }
  await run(inputs)
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
