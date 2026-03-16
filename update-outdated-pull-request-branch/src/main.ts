import * as core from '@actions/core'
import * as github from './github.js'
import { run } from './run.js'

const main = async (): Promise<void> => {
  await run(
    {
      expirationDays: Number(core.getInput('expiration-days')),
      token: core.getInput('token'),
    },
    github.getContext(),
  )
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
