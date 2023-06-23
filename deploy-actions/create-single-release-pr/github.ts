import { getOctokitOptions, GitHub } from '@actions/github/lib/utils'
import * as pluginRetry from '@octokit/plugin-retry'

export const getOctokit = (token: string) => {
  const MyOctokit = GitHub.plugin(pluginRetry.retry)
  return new MyOctokit(getOctokitOptions(token))
}
