import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git'
import { catchHttpStatus, retry } from './retry'

type Inputs = {
  owner: string
  repo: string
  title: string
  body: string
  branch: string
  workspace: string
  project: string
  namespace: string
  service: string
  token: string
}

type Outputs = {
  destinationPullRequestNumber: number
  destinationPullRequestUrl: string
}

export const updateBranchByPullRequest = async (inputs: Inputs): Promise<Outputs | Error> => {
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
    title: inputs.title,
    body: inputs.body,
  })
  core.info(`created ${pull.html_url}`)
  core.summary.addLink(`Pull Request ${inputs.owner}/${inputs.repo}#${pull.number}`, pull.html_url)

  core.info(`adding labels to #${pull.number}`)
  await octokit.rest.issues.addLabels({
    owner: inputs.owner,
    repo: inputs.repo,
    issue_number: pull.number,
    labels: [`project:${inputs.project}`, `namespace:${inputs.namespace}`, `service:${inputs.service}`],
  })
  core.info(`added labels to #${pull.number}`)

  // GitHub merge API returns 405 in the following cases:
  // - "Base branch was modified" error.
  //   https://github.community/t/merging-via-rest-api-returns-405-base-branch-was-modified-review-and-try-the-merge-again/13787
  //   Just retry the API invocation.
  // - The pull request is conflicted.
  //   Need to fetch and recreate a pull request again.
  //
  // We cannot distinguish the error because GitHub returns 405 for both.
  // First this retries the merge API several times.
  // If the error is not resolved, this returns the error to retry in the caller side.
  try {
    return await catchHttpStatus(405, async () => {
      return await retry(
        async () =>
          await catchHttpStatus(405, async () => {
            const { data: merge } = await octokit.rest.pulls.merge({
              owner: inputs.owner,
              repo: inputs.repo,
              pull_number: pull.number,
              merge_method: 'squash',
            })
            core.info(`merged ${pull.html_url} as ${merge.sha}`)
            return {
              destinationPullRequestNumber: pull.number,
              destinationPullRequestUrl: pull.html_url,
            }
          }),
        {
          maxAttempts: 10,
          waitMillisecond: 1000,
        }
      )
    })
  } finally {
    await git.deleteRef(inputs.workspace, topicBranch)
  }
}
