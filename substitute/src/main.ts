import * as core from '@actions/core'
import { parseVariables, run } from '../src/run'

async function main(): Promise<void> {
  await run({
    files: core.getInput('files'),
    variables: parseVariables(core.getMultilineInput('variables', { required: true })),
  })
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
