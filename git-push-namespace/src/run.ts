import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git.js'
import { addNamespace } from './add.js'
import { retry } from './retry.js'

interface Inputs {
  overlay: string
  namespace: string
  destinationRepository: string
  destinationBranch: string
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  await checkIfNamespaceBranchExists(inputs)
  await retry(() => pushNamespaceApplication(inputs), {
    maxAttempts: 5,
    waitMillisecond: 10000,
  })
}

const checkIfNamespaceBranchExists = async (inputs: Inputs): Promise<void> => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-namespace-action-'))
  core.info(`created workspace at ${workspace}`)

  const project = github.context.repo.repo
  const namespaceBranch = `ns/${project}/${inputs.overlay}/${inputs.namespace}`

  core.startGroup(`checking if namespace branch ${namespaceBranch} exists`)
  await git.init(workspace, inputs.destinationRepository, inputs.token)
  await git.checkout(workspace, namespaceBranch)
  core.endGroup()
}

const pushNamespaceApplication = async (inputs: Inputs): Promise<void | Error> => {
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
    return
  }
  return await core.group(`push branch ${inputs.destinationBranch}`, async () => {
    const message = `Deploy namespace ${inputs.namespace}\n\n${commitMessageFooter}`
    await git.commit(workspace, message)
    const code = await git.pushByFastForward(workspace, inputs.destinationBranch)
    if (code > 0) {
      return new Error(`failed to push branch ${inputs.destinationBranch} by fast-forward`)
    }
  })
}

const commitMessageFooter = [
  'git-push-namespace',
  `${github.context.payload.repository?.html_url ?? ''}/commit/${github.context.sha}`,
  `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`,
].join('\n')
