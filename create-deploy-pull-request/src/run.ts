import * as core from '@actions/core'
import * as github from '@actions/github'
import { createPull } from './pull'
import { checkIfBranchExists, createBranch } from './branch'

type Inputs = {
  head: string
  base: string
  title: string
  body: string
  labels: string[]
  owner: string
  repo: string
  actor: string
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const octokit = github.getOctokit(inputs.token)

  core.info(`Checking if base branch exists`)
  const baseBranchExists = await checkIfBranchExists(octokit, {
    owner: inputs.owner,
    repo: inputs.repo,
    branch: inputs.base,
  })
  if (!baseBranchExists) {
    core.info(`Creating base branch`)
    await createBranch(octokit, {
      owner: inputs.owner,
      repo: inputs.repo,
      fromBranch: inputs.head,
      toBranch: inputs.base,
    })
    core.summary.addRaw(`Created base branch: ${inputs.base}`, true)
    return
  }

  await createPull(octokit, {
    owner: inputs.owner,
    repo: inputs.repo,
    head: inputs.head,
    base: inputs.base,
    title: inputs.title,
    body: inputs.body,
    labels: inputs.labels,
    reviewers: [inputs.actor],
    assignees: [inputs.actor],
  })
}
