import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  await run({
    githubToken: core.getInput('github-token', { required: true }),
    headBranch: core.getInput('head-branch', { required: true }),
    baseBranch: core.getInput('base-branch', { required: true }),
    skipCI: core.getBooleanInput('skip-ci', { required: true }),
    mergePullRequest: core.getBooleanInput('merge-pull-request', { required: true }),
  })
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
