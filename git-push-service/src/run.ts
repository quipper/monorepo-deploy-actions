import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git'
import * as glob from '@actions/glob'
import { arrangeManifests, Service } from './arrange'
import { PathVariablesPattern } from './match'

type Inputs = {
  manifests: string
  manifestsPattern?: string
  overlay: string
  namespace: string
  service?: string
  applicationAnnotations: string[]
  destinationRepository: string
  overwrite: boolean
  token: string
}

const parseService = (inputs: Inputs): Service => {
  if (inputs.manifestsPattern !== undefined) {
    return new PathVariablesPattern(inputs.manifestsPattern)
  } else if (inputs.service !== undefined) {
    return inputs.service
  } else {
    throw new Error(`either service or manifests-pattern must be set`)
  }
}

export const run = async (inputs: Inputs): Promise<void> => {
  const service = parseService(inputs)
  const globber = await glob.create(inputs.manifests, { matchDirectories: false })
  const manifests = await globber.glob()

  const maxRetry = 5
  for (let i = 0; i < maxRetry; i++) {
    if (await push(manifests, service, inputs)) {
      return
    }
    const waitMs = Math.floor(10000 * Math.random())
    core.warning(`fast-forward failed, retrying after ${waitMs}ms`)
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }
  throw new Error(`fast-forward failed ${maxRetry} times`)
}

const push = async (manifests: string[], service: Service, inputs: Inputs): Promise<boolean> => {
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
  const services = await arrangeManifests({
    workspace,
    manifests,
    service,
    namespace: inputs.namespace,
    project,
    branch,
    applicationAnnotations: inputs.applicationAnnotations,
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
    const message = `${commitMessage(inputs.namespace, services)}\n\n${commitMessageFooter}`
    await git.commit(workspace, message)
    const code = await git.pushByFastForward(workspace, branch)
    return code === 0
  })
}

const commitMessage = (namespace: string, services: string[]) => {
  if (services.length === 1) {
    return `Add service ${namespace}/${services[0]}`
  }
  return `Add ${services.length} services to namespace ${namespace}`
}

const commitMessageFooter = [
  github.context.payload.pull_request?.html_url ?? '',
  `${github.context.payload.repository?.html_url ?? ''}/commit/${github.context.sha}`,
].join('\n')
