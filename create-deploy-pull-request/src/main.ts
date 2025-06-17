import * as core from '@actions/core'
import * as github from './github.js'
import { run } from './run.js'

const main = async (): Promise<void> => {
  const outputs = await run(
    {
      head: core.getInput('head-branch', { required: true }),
      base: core.getInput('base-branch', { required: true }),
      title: core.getInput('title', { required: true }),
      body: core.getInput('body', { required: true }),
      labels: core.getMultilineInput('labels'),
      draft: core.getBooleanInput('draft', { required: true }),
      now: () => new Date(),
      timeZone: core.getInput('time-zone') || undefined,
    },
    github.getOctokit(),
    github.getContext(),
  )
  await core.summary.write()
  if (outputs.pullRequestUrl) {
    core.setOutput('pull-request-url', outputs.pullRequestUrl)
  }
  if (outputs.pullRequestNumber) {
    core.setOutput('pull-request-number', outputs.pullRequestNumber)
  }
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
