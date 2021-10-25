import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  const outputs = await run({
    retain: core.getMultilineInput('retain-pull-request-numbers'),
    overlay: core.getInput('overlay', { required: true }),
    namespacePrefix: core.getInput('namespace-prefix', { required: true }),
    destinationRepository: core.getInput('destination-repository', { required: true }),
    destinationBranch: core.getInput('destination-branch', { required: true }),
    token: core.getInput('token', { required: true }),
    dryRun: core.getBooleanInput('dry-run', { required: true }),
  })
  core.setOutput('deleted-pull-request-numbers', outputs.deletedPullRequestNumbers.join('\n'))
}

main().catch((e) => core.setFailed(e instanceof Error ? e.message : JSON.stringify(e)))
