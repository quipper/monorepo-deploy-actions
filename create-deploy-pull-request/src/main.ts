import * as core from '@actions/core'
import * as github from '@actions/github'
import { run } from './run'

const main = async (): Promise<void> => {
  await run({
    head: core.getInput('head-branch', { required: true }),
    via: core.getInput('via-branch') || undefined,
    base: core.getInput('base-branch', { required: true }),
    title: core.getInput('title', { required: true }),
    body: core.getInput('body', { required: true }),
    labels: core.getMultilineInput('labels'),
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    actor: github.context.actor,
    token: core.getInput('token', { required: true }),
  })
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
