import assert from 'node:assert'
import { Octokit } from '@octokit/action'
import { retry } from '@octokit/plugin-retry'

export const getOctokit = (token: string) =>
  new (Octokit.plugin(retry))({
    // Disable @octokit/action authStrategy and use the github-token input instead.
    authStrategy: null,
    auth: token,
  })

export type Context = {
  actor: string
  repo: {
    owner: string
    repo: string
  }
  runId: string
}

export const getContext = (): Context => {
  // https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables
  return {
    actor: getEnv('GITHUB_ACTOR'),
    repo: getRepo(),
    runId: getEnv('GITHUB_RUN_ID'),
  }
}

const getRepo = () => {
  const [owner, repo] = getEnv('GITHUB_REPOSITORY').split('/')
  return { owner, repo }
}

const getEnv = (name: string): string => {
  assert(process.env[name], `${name} is required`)
  return process.env[name]
}
