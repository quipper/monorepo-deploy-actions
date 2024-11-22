import * as core from '@actions/core'
import * as github from '@actions/github'
import { createPull } from './pull.js'
import { checkIfBranchExists, createBranch } from './branch.js'

type Octokit = ReturnType<typeof github.getOctokit>

type Inputs = {
  head: string
  base: string
  title: string
  body: string
  draft: boolean
  labels: string[]
  owner: string
  repo: string
  actor: string
  now: () => Date
  timeZone: string | undefined
}

type Outputs = {
  pullRequestUrl?: string
}

export const run = async (inputs: Inputs, octokit: Octokit): Promise<Outputs> => {
  core.info(`Checking if ${inputs.base} branch exists`)
  const baseBranchExists = await checkIfBranchExists(octokit, {
    owner: inputs.owner,
    repo: inputs.repo,
    branch: inputs.base,
  })
  if (!baseBranchExists) {
    core.info(`Creating ${inputs.base} branch because it does not exist`)
    await createBranch(octokit, {
      owner: inputs.owner,
      repo: inputs.repo,
      fromBranch: inputs.head,
      toBranch: inputs.base,
    })
    core.summary.addRaw(`Created ${inputs.base} branch`, true)
    return {}
  }

  core.info(`Creating a pull request from ${inputs.head} to ${inputs.base}`)
  const timestamp = formatISO8601LocalTime(inputs.now(), inputs.timeZone)
  const pull = await createPull(octokit, {
    owner: inputs.owner,
    repo: inputs.repo,
    head: inputs.head,
    base: inputs.base,
    title: `${inputs.title} at ${timestamp}`,
    body: inputs.body,
    draft: inputs.draft,
    labels: inputs.labels,
    reviewers: [inputs.actor],
    assignees: [inputs.actor],
  })
  return {
    pullRequestUrl: pull.html_url,
  }
}

// https://stackoverflow.com/questions/25050034/get-iso-8601-using-intl-datetimeformat
const formatISO8601LocalTime = (d: Date, timeZone?: string) => d.toLocaleString('sv-SE', { timeZone })
