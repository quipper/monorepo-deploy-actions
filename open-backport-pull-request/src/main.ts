import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  await run({
    githubToken: core.getInput('github-token', { required: true }),
    baseBranch: core.getInput('base-branch', { required: true }),
  })
}

main().catch((error) => core.setFailed(error))
