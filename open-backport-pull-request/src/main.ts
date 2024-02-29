import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  const outputs = await run({
    githubToken: core.getInput('github-token', { required: true }),
    headBranch: core.getInput('head-branch', { required: true }),
    baseBranch: core.getInput('base-branch', { required: true }),
    skipCI: core.getBooleanInput('skip-ci', { required: true }),
    mergePullRequest: core.getBooleanInput('merge-pull-request', { required: true }),
  })
  if (outputs) {
    core.setOutput('pull-request-url', outputs.pullRequestUrl)
    core.setOutput('base-branch', outputs.baseBranch)
    core.setOutput('head-branch', outputs.headBranch)
    core.setOutput('merged', outputs.merged)
  }
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
