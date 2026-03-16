import assert from 'node:assert'
import * as github from '@actions/github'
import * as octokitPluginRetry from '@octokit/plugin-retry'

export type Octokit = ReturnType<typeof github.getOctokit>

export const getOctokit = (token: string) => github.getOctokit(token, {}, octokitPluginRetry.retry)

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
