import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git'
import { RequestError } from '@octokit/request-error'

type Inputs = {
  owner: string
  repo: string
  branch: string
  workspace: string
  namespace: string
  service: string
  token: string
}

export const updateBranchByPullRequest = async (inputs: Inputs): Promise<void | Error> => {
  const topicBranch = `git-push-service--${inputs.namespace}--${inputs.service}--${Date.now()}`
  const code = await core.group(`push branch ${topicBranch}`, () =>
    git.pushByFastForward(inputs.workspace, topicBranch)
  )
  if (code > 0) {
    return new Error(`failed to push branch ${topicBranch} by fast-forward`)
  }

  const octokit = github.getOctokit(inputs.token)
  core.info(`creating a pull request from ${topicBranch} into ${inputs.branch}`)
  const { data: pull } = await octokit.rest.pulls.create({
    owner: inputs.owner,
    repo: inputs.repo,
    base: inputs.branch,
    head: topicBranch,
  })
  core.info(`created ${pull.html_url}`)

  try {
    const { data: merge } = await octokit.rest.pulls.merge({
      owner: inputs.owner,
      repo: inputs.repo,
      pull_number: pull.number,
      merge_method: 'squash',
    })
    core.info(`merged ${pull.html_url} as ${merge.sha}`)
  } catch (e) {
    if (e instanceof RequestError && e.status === 422) {
      return e // retry when merge was failed
    }
    throw e
  }
}
