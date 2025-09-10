import * as core from '@actions/core'
import { createOrUpdatePull } from './pull.js'
import { checkIfBranchExists, createBranch } from './branch.js'
import { Octokit } from '@octokit/action'
import { Context } from './github.js'

type Inputs = {
  head: string
  base: string
  title: string
  body: string
  draft: boolean
  labels: string[]
  now: () => Date
  timeZone: string | undefined
}

type Outputs = {
  pullRequestUrl?: string
  pullRequestNumber?: number
}

export const run = async (inputs: Inputs, octokit: Octokit, context: Context): Promise<Outputs> => {
  core.info(`Checking if ${inputs.base} branch exists`)
  const baseBranchExists = await checkIfBranchExists(octokit, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    branch: inputs.base,
  })
  if (!baseBranchExists) {
    core.info(`Creating ${inputs.base} branch because it does not exist`)
    await createBranch(octokit, {
      owner: context.repo.owner,
      repo: context.repo.repo,
      fromBranch: inputs.head,
      toBranch: inputs.base,
    })
    core.summary.addRaw(`Created ${inputs.base} branch`, true)
    return {}
  }

  const reviewers = []
  if (context.eventName === 'workflow_dispatch') {
    core.info(`Requesting a review to @${context.actor} because the workflow was manually triggered`)
    reviewers.push(context.actor)
  }

  core.info(`Creating a pull request from ${inputs.head} to ${inputs.base}`)
  const timestamp = formatISO8601LocalTime(inputs.now(), inputs.timeZone)
  const pull = await createOrUpdatePull(octokit, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    head: inputs.head,
    base: inputs.base,
    title: `${inputs.title} at ${timestamp}`,
    body: inputs.body,
    draft: inputs.draft,
    labels: inputs.labels,
    reviewers,
    assignees: reviewers,
  })
  return {
    pullRequestUrl: pull.html_url,
    pullRequestNumber: pull.number,
  }
}

// https://stackoverflow.com/questions/25050034/get-iso-8601-using-intl-datetimeformat
const formatISO8601LocalTime = (d: Date, timeZone?: string) => d.toLocaleString('sv-SE', { timeZone })
