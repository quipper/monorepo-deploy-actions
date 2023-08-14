import * as core from '@actions/core'
import { run } from '../src/run'

async function main(): Promise<void> {
  const outputs = await run({
    manifests: core.getInput('manifests', { required: true }),
    overlay: core.getInput('overlay', { required: true }),
    namespace: core.getInput('namespace', { required: true }),
    service: core.getInput('service'),
    namespaceLevel: core.getBooleanInput('namespace-level', { required: true }),
    applicationAnnotations: core.getMultilineInput('application-annotations'),
    destinationRepository: core.getInput('destination-repository', { required: true }),
    destinationBranch: core.getInput('destination-branch'),
    prebuilt: core.getBooleanInput('prebuilt', { required: true }), // TODO: deprecated
    updateViaPullRequest: core.getBooleanInput('update-via-pull-request', { required: true }),
    token: core.getInput('token', { required: true }),
  })
  if (outputs.destinationPullRequestNumber !== undefined) {
    core.setOutput('destination-pull-request-number', outputs.destinationPullRequestNumber)
  }
  if (outputs.destinationPullRequestUrl !== undefined) {
    core.setOutput('destination-pull-request-url', outputs.destinationPullRequestUrl)
  }
  await core.summary.write()
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
