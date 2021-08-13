import * as core from '@actions/core'
import { parseVariables, run } from '../src/run'

async function main(): Promise<void> {
  await run({
    manifests: core.getMultilineInput('manifests', { required: true }),
    pathPatterns: core.getMultilineInput('path-patterns'),
    variables: parseVariables(core.getMultilineInput('variables', { required: true })),
  })
}

main().catch((error) => core.setFailed(error))
