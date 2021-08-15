import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git'
import { addNamespace } from './add'

interface Inputs {
  overlay: string
  namespace: string
  destinationRepository: string
  destinationBranch: string
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const maxRetry = 3
  const waitMs = 3000
  for (let i = 0; i < maxRetry; i++) {
    if (await push(inputs)) {
      return
    }
    core.warning(`fast-forward failed, retrying after ${waitMs}ms`)
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }
  throw new Error(`fast-forward failed ${maxRetry} times`)
}

const push = async (inputs: Inputs): Promise<boolean> => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-namespace-action-'))
  core.info(`created workspace at ${workspace}`)

  core.startGroup(`checkout branch ${inputs.destinationBranch}`)
  await git.init(workspace, inputs.destinationRepository, inputs.token)
  await git.checkout(workspace, inputs.destinationBranch)
  core.endGroup()

  const project = github.context.repo.repo
  await addNamespace({
    workspace,
    overlay: inputs.overlay,
    namespace: inputs.namespace,
    project,
    destinationRepository: inputs.destinationRepository,
  })

  const status = await git.status(workspace)
  if (status === '') {
    core.info('nothing to commit')
    return true
  }
  return await core.group(`push branch ${inputs.destinationBranch}`, async () => {
    const message = `Add namespace ${inputs.namespace}\n\n${commitMessageFooter}`
    await git.commit(workspace, message)
    const code = await git.pushByFastForward(workspace, inputs.destinationBranch)
    return code === 0
  })
}

const commitMessageFooter = [
  github.context.payload.pull_request?.html_url ?? '',
  `${github.context.payload.repository?.html_url ?? ''}/commit/${github.context.sha}`,
].join('\n')
