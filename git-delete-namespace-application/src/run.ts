import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git'
import { deletePullRequests } from './delete'
import { retry } from './retry'

type Inputs = {
  retain: string[]
  overlay: string
  namespacePrefix: string
  destinationRepository: string
  destinationBranch: string
  token: string
  dryRun: boolean
}

type Outputs = {
  deletedPullRequestNumbers: string[]
}

export const run = async (inputs: Inputs): Promise<Outputs> =>
  await retry(async () => await push(inputs), {
    maxAttempts: 5,
    waitMillisecond: 10000,
  })

const push = async (inputs: Inputs): Promise<Outputs | Error> => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'stop-pull-request-'))
  core.info(`created workspace at ${workspace}`)

  core.startGroup(`checkout branch ${inputs.destinationBranch}`)
  await git.init(workspace, inputs.destinationRepository, inputs.token)
  await git.checkout(workspace, inputs.destinationBranch)
  core.endGroup()

  const project = github.context.repo.repo
  const deletedPullRequestNumbers = await deletePullRequests({
    directory: `${workspace}/${project}/${inputs.overlay}`,
    retain: inputs.retain,
    namespacePrefix: inputs.namespacePrefix,
  })

  const status = await git.status(workspace)
  if (status === '') {
    core.info('nothing to commit')
    return { deletedPullRequestNumbers: [] }
  }
  return await core.group(`push branch ${inputs.destinationBranch}`, async () => {
    const message = `git-delete-namespace-application: delete ${deletedPullRequestNumbers.length} applications\n\n${commitMessageFooter}`
    await git.commit(workspace, message)

    if (inputs.dryRun) {
      core.info(`(dry-run) exit`)
      return { deletedPullRequestNumbers: [] }
    }
    const code = await git.pushByFastForward(workspace, inputs.destinationBranch)
    if (code === 0) {
      return { deletedPullRequestNumbers }
    }
    return new Error(`failed to push branch ${inputs.destinationBranch} by fast-forward`)
  })
}

const commitMessageFooter = [
  github.context.payload.pull_request?.html_url ?? '',
  `${github.context.payload.repository?.html_url ?? ''}/commit/${github.context.sha}`,
].join('\n')
