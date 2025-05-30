import * as core from '@actions/core'
import { run } from '../src/run.js'

const main = async (): Promise<void> => {
  const outputs = await run({
    manifests: core.getInput('manifests', { required: true }),
    overlay: core.getInput('overlay', { required: true }),
    namespace: core.getInput('namespace', { required: true }),
    service: core.getInput('service', { required: true }),
    applicationAnnotations: core.getMultilineInput('application-annotations'),
    destinationRepository: core.getInput('destination-repository', { required: true }),
    destinationBranch: core.getInput('destination-branch'),
    updateViaPullRequest: core.getBooleanInput('update-via-pull-request', { required: true }),
    token: core.getInput('token', { required: true }),
    currentHeadRef: core.getInput('current-head-ref', { required: true }),
    currentHeadSha: core.getInput('current-head-sha', { required: true }),
  })
  if (outputs?.destinationPullRequest !== undefined) {
    core.setOutput('destination-pull-request-number', outputs.destinationPullRequest.number)
    core.setOutput('destination-pull-request-url', outputs.destinationPullRequest.url)
  }
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
