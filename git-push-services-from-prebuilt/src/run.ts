import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as git from './git'
import * as github from '@actions/github'
import { arrangeManifests } from './arrange'
import { retry } from './retry'

interface Inputs {
  prebuiltDirectory: string
  overlay: string
  namespace: string
  destinationRepository: string
  token: string
}

export const run = async (inputs: Inputs): Promise<void> =>
  await retry(async () => await push(inputs), {
    maxAttempts: 50,
    waitMillisecond: 10000,
  })

const push = async (inputs: Inputs): Promise<void | Error> => {
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
    return
  }
  return await core.group(`push branch ${branch}`, async () => {
    const message = `${commitMessage(inputs.namespace)}\n\n${commitMessageFooter}`
    await git.commit(workspace, message)
    const code = await git.pushByFastForward(workspace, branch)
    if (code > 0) {
      return new Error(`failed to push branch ${branch} by fast-forward`)
    }
  })
}

const commitMessage = (namespace: string) => {
  return `Deploy ${namespace} from prebuilt`
}

const commitMessageFooter = [
  'git-push-services-from-prebuilt',
  `${github.context.payload.repository?.html_url ?? ''}/commit/${github.context.sha}`,
  `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`,
].join('\n')
