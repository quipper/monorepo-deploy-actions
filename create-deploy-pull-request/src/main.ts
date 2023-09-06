import * as core from '@actions/core'
import * as github from '@actions/github'
import { run } from './run'

const main = async (): Promise<void> => {
  await run({
    head: core.getInput('head-branch', { required: true }),
    base: core.getInput('base-branch', { required: true }),
    title: core.getInput('title', { required: true }),
    body: core.getInput('body', { required: true }),
    labels: core.getMultilineInput('labels'),
    draft: core.getBooleanInput('draft', { required: true }),
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    actor: github.context.actor,
    token: core.getInput('token', { required: true }),
  })
  await core.summary.write()
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
