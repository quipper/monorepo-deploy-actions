import * as core from '@actions/core'
import { GitHub } from '@actions/github/lib/utils'

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
    if (isRequestError(error) && error.status === 404) {
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
  core.info(`Getting the commit of branch ${options.fromBranch}`)
  const { data: fromBranch } = await octokit.rest.repos.getBranch({
    owner: options.owner,
    repo: options.repo,
    branch: options.fromBranch,
  })

  core.info(`From commit ${fromBranch.commit.sha} of branch ${options.fromBranch}`)
  core.info(`Creating a new branch ${options.toBranch}`)
  await octokit.rest.git.createRef({
    owner: options.owner,
    repo: options.repo,
    ref: `refs/heads/${options.toBranch}`,
    sha: fromBranch.commit.sha,
  })
}

type RequestError = Error & { status: number }

const isRequestError = (error: unknown): error is RequestError =>
  error instanceof Error && 'status' in error && typeof error.status === 'number'
