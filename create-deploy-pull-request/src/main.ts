import * as core from '@actions/core'
import * as github from '@actions/github'
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
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      actor: github.context.actor,
      eventName: github.context.eventName,
      now: () => new Date(),
      timeZone: core.getInput('time-zone') || undefined,
    },
    github.getOctokit(core.getInput('token', { required: true })),
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
