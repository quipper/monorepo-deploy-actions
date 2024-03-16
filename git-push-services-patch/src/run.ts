import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as git from './git'
import * as github from '@actions/github'
import * as patch from './patch'
import { retry } from './retry'

type Inputs = {
  patch: string
  operation: Operation
  overlay: string
  namespace: string
  services: string[]
  excludeServices: string[]
  destinationRepository: string
  token: string
}

type Operation = 'add' | 'delete'

export const operationOf = (s: string): Operation => {
  if (s === 'add') {
    return s
  }
  if (s === 'delete') {
    return s
  }
  throw new Error(`unknown operation ${s}`)
}

export const run = async (inputs: Inputs): Promise<void> =>
  await retry(async () => await push(inputs), {
    maxAttempts: 50,
    waitMillisecond: 10000,
  })

const push = async (inputs: Inputs): Promise<void | Error> => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-patch-'))
  core.info(`created workspace at ${workspace}`)

  const [owner, repo] = inputs.destinationRepository.split('/')
  const project = github.context.repo.repo
  const branch = `ns/${project}/${inputs.overlay}/${inputs.namespace}`

  core.startGroup(`checkout branch ${branch}`)
  await git.init(workspace, owner, repo, inputs.token)
  await git.checkout(workspace, branch)
  core.endGroup()

  if (inputs.operation === 'add') {
    await patch.addToServices({
      workspace,
      patch: inputs.patch,
      services: new Set(inputs.services),
      excludeServices: new Set(inputs.excludeServices),
    })
  } else if (inputs.operation === 'delete') {
    await patch.deleteFromServices({
      workspace,
      patch: inputs.patch,
      services: new Set(inputs.services),
      excludeServices: new Set(inputs.excludeServices),
    })
  }

  const status = await git.status(workspace)
  if (status === '') {
    core.info('nothing to commit')
    return
  }
  return await core.group(`push branch ${branch}`, async () => {
    const message = `${commitMessage(inputs.namespace, inputs.operation)}\n\n${commitMessageFooter}`
    await git.commit(workspace, message)
    const code = await git.pushByFastForward(workspace, branch)
    if (code > 0) {
      return new Error(`failed to push branch ${branch} by fast-forward`)
    }
  })
}

const commitMessage = (namespace: string, operation: Operation) => {
  if (operation === 'add') {
    return `Add patch into ${namespace}`
  }
  return `Delete patch from ${namespace}`
}

const commitMessageFooter = [
  'git-push-services-patch',
  `${github.context.payload.repository?.html_url ?? ''}/commit/${github.context.sha}`,
  `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`,
].join('\n')
