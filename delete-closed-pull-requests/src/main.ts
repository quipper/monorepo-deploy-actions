import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  await run({
    overlay: core.getInput('overlay', { required: true }),
    namespacePrefix: core.getInput('namespace-prefix', { required: true }),
    sourceRepository: core.getInput('source-repository', { required: true }),
    sourceRepositoryToken: core.getInput('source-repository-token', { required: true }),
    destinationRepository: core.getInput('destination-repository', { required: true }),
    destinationBranch: core.getInput('destination-branch', { required: true }),
    destinationRepositoryToken: core.getInput('destination-repository-token', { required: true }),
    excludeUpdatedWithinMinutes: getIntegerInput('exclude-updated-within-minutes'),
    dryRun: core.getBooleanInput('dry-run', { required: true }),
  })
}

const getIntegerInput = (key: string) => {
  const n = Number.parseInt(core.getInput(key, { required: true }))
  if (Number.isSafeInteger(n)) {
    return n
  }
  throw new Error(`Input ${key} must be an integer (${n})`)
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
