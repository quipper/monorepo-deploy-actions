import * as core from '@actions/core'
import type { Octokit } from '@octokit/action'
import * as git from './git.js'
import { catchHttpStatus, retry } from './retry.js'

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
}

type PullRequest = {
  number: number
  url: string
}

export const updateBranchByPullRequest = async (octokit: Octokit, inputs: Inputs): Promise<PullRequest | Error> => {
  const topicBranch = `git-push-service--${inputs.namespace}--${inputs.service}--${Date.now()}`
  const code = await core.group(`Push branch ${topicBranch}`, () =>
    git.pushByFastForward(inputs.workspace, topicBranch),
  )
  if (code > 0) {
    return new Error(`Failed to push branch ${topicBranch} by fast-forward`)
  }

  core.info(`Creating a pull request from ${topicBranch} into ${inputs.branch}`)
  const { data: pull } = await octokit.rest.pulls.create({
    owner: inputs.owner,
    repo: inputs.repo,
    base: inputs.branch,
    head: topicBranch,
    title: inputs.title,
    body: inputs.body,
  })
  core.info(`Created ${pull.html_url}`)

  core.info(`Adding labels to #${pull.number}`)
  await octokit.rest.issues.addLabels({
    owner: inputs.owner,
    repo: inputs.repo,
    issue_number: pull.number,
    labels: [`project:${inputs.project}`, `namespace:${inputs.namespace}`, `service:${inputs.service}`],
    request: {
      // GitHub API may return 422 error.
      // For example: HttpError: Validation Failed: {"resource":"Label","code":"unprocessable","field":"data","message":"Could not resolve to a node with the global id of 'PR_...'."}
      // This option will retry regardless of the response code.
      // See https://github.com/octokit/plugin-retry.js/
      retries: 3,
      retryAfter: 1,
    },
  })
  core.info(`Added labels to #${pull.number}`)

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
            core.info(`Merged ${pull.html_url} as ${merge.sha}`)
            return {
              number: pull.number,
              url: pull.html_url,
            }
          }),
        {
          maxAttempts: 10,
          waitMillisecond: 1000,
        },
      )
    })
  } finally {
    await git.deleteRef(inputs.workspace, topicBranch)
  }
}
