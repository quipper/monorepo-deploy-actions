import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  const outputs = await run({
    rules: core.getInput('matches', { required: true }),
  })
  core.setOutput('json', outputs.environments)
}

main().catch((e) => core.setFailed(e instanceof Error ? e.message : JSON.stringify(e)))
