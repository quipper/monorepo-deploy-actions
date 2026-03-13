import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as core from '@actions/core'
import * as git from './git.js'
import type * as github from './github.js'
import * as patch from './patch.js'
import { retry } from './retry.js'

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

export const run = async (inputs: Inputs, context: github.Context): Promise<void> =>
  await retry(async () => await push(inputs, context), {
    maxAttempts: 50,
    waitMillisecond: 10000,
  })

const push = async (inputs: Inputs, context: github.Context): Promise<undefined | Error> => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-patch-'))
  core.info(`created workspace at ${workspace}`)

  const [owner, repo] = inputs.destinationRepository.split('/')
  const project = context.repo.repo
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
    const message = `${commitMessage(inputs.namespace, inputs.operation)}\n\n${getCommitMessageFooter(context)}`
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

const getCommitMessageFooter = (context: github.Context) =>
  [
    'git-push-services-patch',
    `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/commit/${context.sha}`,
    `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
  ].join('\n')
