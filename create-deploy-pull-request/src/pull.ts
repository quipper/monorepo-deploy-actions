import * as core from '@actions/core'
import { Octokit } from '@octokit/action'

type CreatePullOptions = {
  owner: string
  repo: string
  head: string
  base: string
  title: string
  body: string
  draft: boolean
  labels: string[]
  reviewers: string[]
  assignees: string[]
}

type Pull = {
  html_url: string
  number: number
}

export const createOrUpdatePull = async (octokit: Octokit, options: CreatePullOptions): Promise<Pull> => {
  const pull = await createOrUpdate(octokit, options)
  if (options.reviewers.length > 0) {
    core.info(`Requesting a review to ${options.reviewers.join(', ')}`)
    await octokit.rest.pulls.requestReviewers({
      owner: options.owner,
      repo: options.repo,
      pull_number: pull.number,
      reviewers: options.reviewers,
    })
  }
  if (options.assignees.length > 0) {
    core.info(`Adding assignees ${options.assignees.join(', ')}`)
    await octokit.rest.issues.addAssignees({
      owner: options.owner,
      repo: options.repo,
      issue_number: pull.number,
      assignees: options.assignees,
    })
  }
  if (options.labels.length > 0) {
    core.info(`Adding labels ${options.labels.join(', ')}`)
    await octokit.rest.issues.addLabels({
      owner: options.owner,
      repo: options.repo,
      issue_number: pull.number,
      labels: options.labels,
    })
  }
  return pull
}

const createOrUpdate = async (octokit: Octokit, options: CreatePullOptions) => {
  core.info(`Finding an existing pull request of ${options.head} -> ${options.base}`)
  const { data: exists } = await octokit.rest.pulls.list({
    owner: options.owner,
    repo: options.repo,
    base: options.base,
    // head must be in the format of `organization:ref-name`
    // https://docs.github.com/en/rest/pulls/pulls#list-pull-requests
    head: `${options.owner}:${options.head}`,
  })
  if (exists.length > 0) {
    const pull = exists[0]
    core.info(`Updating the existing pull request ${pull.html_url}`)
    await octokit.rest.pulls.update({
      owner: options.owner,
      repo: options.repo,
      pull_number: pull.number,
      title: options.title,
      body: options.body,
    })
    core.info(`Updated ${pull.html_url}`)
    core.summary.addRaw(`Updated the existing pull request: [#${pull.number} ${pull.title}](${pull.html_url})`, true)
    return pull
  }

  core.info(`Creating a pull request from ${options.head} to ${options.base}`)
  const { data: pull } = await octokit.rest.pulls.create({
    owner: options.owner,
    repo: options.repo,
    base: options.base,
    head: options.head,
    title: options.title,
    body: options.body,
    draft: options.draft,
  })
  core.info(`Created ${pull.html_url}`)
  core.summary.addRaw(`Created a pull request: [#${pull.number} ${pull.title}](${pull.html_url})`, true)
  return pull
}
