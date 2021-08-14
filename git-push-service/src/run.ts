import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git'
import * as glob from '@actions/glob'
import { arrangeManifests } from './arrange'
import { PathVariablesPattern } from './match'

type Inputs = {
  manifests: string
  manifestsPattern: string
  overlay: string
  namespace: string
  destinationRepository: string
  overwrite: boolean
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const manifests = await (await glob.create(inputs.manifests, { matchDirectories: false })).glob()

  const maxRetry = 3
  const waitMs = 3000
  for (let i = 0; i < maxRetry; i++) {
    if (await push(manifests, inputs)) {
      return
    }
    core.warning(`fast-forward failed, retrying after ${waitMs}ms`)
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }
  throw new Error(`fast-forward failed ${maxRetry} times`)
}

const push = async (manifests: string[], inputs: Inputs): Promise<boolean> => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-service-action-'))
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
    manifests,
    manifestsPattern: new PathVariablesPattern(inputs.manifestsPattern),
    namespace: inputs.namespace,
    project,
    branch,
    destinationRepository: inputs.destinationRepository,
    overwrite: inputs.overwrite,
  })
  core.endGroup()

  const status = await git.status(workspace)
  if (status === '') {
    core.info('nothing to commit')
    return true
  }
  return await core.group(`push branch ${branch}`, async () => {
    const message = `Create namespace ${inputs.namespace}\n\n${commitMessageFooter}`
    await git.commit(workspace, message)
    const code = await git.pushByFastForward(workspace, branch)
    return code === 0
  })
}

const commitMessageFooter = [
  github.context.payload.pull_request?.html_url ?? '',
  `${github.context.payload.repository?.html_url ?? ''}/commit/${github.context.sha}`,
].join('\n')
