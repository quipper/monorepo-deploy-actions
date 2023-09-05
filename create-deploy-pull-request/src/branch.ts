import * as core from '@actions/core'
import { GitHub } from '@actions/github/lib/utils'
import { RequestError } from '@octokit/request-error'

type Octokit = InstanceType<typeof GitHub>

type CheckIfBranchExistsOptions = {
  owner: string
  repo: string
  branch: string
}

export const checkIfBranchExists = async (octokit: Octokit, options: CheckIfBranchExistsOptions): Promise<boolean> => {
  try {
    await octokit.rest.repos.getBranch(options)
    return true
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) {
      core.info(`Branch ${options.branch} does not exist: ${error.message}`)
      return false
    }
    throw error
  }
}

type CreateUpdateBranchOptions = {
  owner: string
  repo: string
  fromBranch: string
  toBranch: string
}

export const createBranch = async (octokit: Octokit, options: CreateUpdateBranchOptions) => {
  core.info(`Getting branch ${options.fromBranch}`)
  const { data: fromBranch } = await octokit.rest.repos.getBranch({
    owner: options.owner,
    repo: options.repo,
    branch: options.fromBranch,
  })

  core.info(`Creating branch ${options.toBranch} from ${fromBranch.commit.sha}`)
  await octokit.rest.git.createRef({
    owner: options.owner,
    repo: options.repo,
    ref: `refs/heads/${options.toBranch}`,
    sha: fromBranch.commit.sha,
  })
}

export const createOrUpdateBranch = async (octokit: Octokit, options: CreateUpdateBranchOptions) => {
  core.info(`Getting branch ${options.fromBranch}`)
  const { data: fromBranch } = await octokit.rest.repos.getBranch({
    owner: options.owner,
    repo: options.repo,
    branch: options.fromBranch,
  })
  const sha = fromBranch.commit.sha

  core.info(`Checking if branch ${options.toBranch} exists`)
  const toBranchExists = await checkIfBranchExists(octokit, {
    owner: options.owner,
    repo: options.repo,
    branch: options.toBranch,
  })
  if (toBranchExists) {
    core.info(`Updating branch ${options.toBranch} to sha ${sha}`)
    await octokit.rest.git.updateRef({
      owner: options.owner,
      repo: options.repo,
      ref: `heads/${options.toBranch}`,
      sha,
      force: true,
    })
    return
  }

  core.info(`Creating branch ${options.toBranch} from sha ${sha}`)
  await octokit.rest.git.createRef({
    owner: options.owner,
    repo: options.repo,
    ref: `refs/heads/${options.toBranch}`,
    sha,
  })
}
