import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  await run({
    retainPullRequestNumbers: core.getMultilineInput('retain-pull-request-numbers'),
    namespacePrefix: core.getInput('namespace-prefix', { required: true }),
    overlay: core.getInput('overlay', { required: true }),
    destinationRepository: core.getInput('destination-repository', { required: true }),
    token: core.getInput('token', { required: true }),
    dryRun: core.getBooleanInput('dry-run', { required: true }),
  })
}

main().catch((e) => core.setFailed(e instanceof Error ? e.message : JSON.stringify(e)))
