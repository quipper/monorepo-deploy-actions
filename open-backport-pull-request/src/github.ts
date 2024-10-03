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
  runId: number
}
