import * as core from '@actions/core'
import { parseVariables, run } from '../src/run'

async function main(): Promise<void> {
  await run({
    files: core.getInput('files', { required: true }),
    pathVariablesPattern: core.getInput('path-variables-pattern') || undefined,
    variables: parseVariables(core.getMultilineInput('variables', { required: true })),
  })
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
