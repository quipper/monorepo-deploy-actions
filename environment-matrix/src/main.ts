import * as core from '@actions/core'
import * as github from './github.js'
import { run } from './run.js'

const main = async (): Promise<void> => {
  const outputs = await run(
    {
      rules: core.getInput('rules', { required: true }),
    },
    github.getOctokit(),
    github.getContext(),
  )
  core.setOutput('json', outputs.json)
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
