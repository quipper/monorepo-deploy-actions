import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  const outputs = await run({
    rules: core.getInput('rules', { required: true }),
  })
  core.setOutput('json', outputs.environments)
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
