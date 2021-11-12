import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as git from './git'
import * as github from '@actions/github'
import { arrangeManifests } from './arrange'

interface Inputs {
  prebuiltDirectory: string
  overlay: string
  namespace: string
  destinationRepository: string
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const maxRetry = 30
  for (let i = 0; i < maxRetry; i++) {
    if (await push(inputs)) {
      return
    }
    const waitMs = Math.floor(3000 * Math.random())
    core.warning(`fast-forward failed, retrying after ${waitMs}ms`)
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }
  throw new Error(`fast-forward failed ${maxRetry} times`)
}

const push = async (inputs: Inputs): Promise<boolean> => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-from-prebuilt--build-'))
  core.info(`created workspace at ${workspace}`)

  const [owner, repo] = inputs.destinationRepository.split('/')
  const project = github.context.repo.repo
  const branch = `ns/${project}/${inputs.overlay}/${inputs.namespace}`

  core.startGroup(`checkout branch ${branch} if exist`)
  await git.init(workspace, owner, repo, inputs.token)
  await git.checkoutIfExist(workspace, branch)
  core.endGroup()

  core.startGroup(`arrange manifests into workspace ${workspace}`)
  await arrangeManifests({
    workspace,
    prebuiltDirectory: inputs.prebuiltDirectory,
    namespace: inputs.namespace,
    project,
    branch,
    context: {
      sha: github.context.sha,
      ref: github.context.ref,
    },
    destinationRepository: inputs.destinationRepository,
  })
  core.endGroup()

  const status = await git.status(workspace)
  if (status === '') {
    core.info('nothing to commit')
    return true
  }
  return await core.group(`push branch ${branch}`, async () => {
    const message = `${commitMessage(inputs.namespace)}\n\n${commitMessageFooter}`
    await git.commit(workspace, message)
    const code = await git.pushByFastForward(workspace, branch)
    return code === 0
  })
}

const commitMessage = (namespace: string) => {
  return `Deploy ${namespace} from prebuilt`
}

const commitMessageFooter = [
  'git-push-services-from-prebuilt',
  github.context.payload.pull_request?.html_url ?? '',
  `${github.context.payload.repository?.html_url ?? ''}/commit/${github.context.sha}`,
  `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`,
].join('\n')
