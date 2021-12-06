import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git'
import * as glob from '@actions/glob'
import { arrangeManifests } from './arrange'
import { retry } from './retry'

type Inputs = {
  manifests: string
  overlay: string
  namespace: string
  service: string
  applicationAnnotations: string[]
  destinationRepository: string
  prebuilt: boolean
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const globber = await glob.create(inputs.manifests, { matchDirectories: false })
  const manifests = await globber.glob()

  return await retry(async () => push(manifests, inputs), {
    maxAttempts: 50,
    waitMillisecond: 10000,
  })
}

const push = async (manifests: string[], inputs: Inputs): Promise<void | Error> => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-service-action-'))
  core.info(`created workspace at ${workspace}`)

  const [owner, repo] = inputs.destinationRepository.split('/')
  const project = github.context.repo.repo
  const branch = inputs.prebuilt
    ? `prebuilt/${project}/${inputs.overlay}/${github.context.ref}`
    : `ns/${project}/${inputs.overlay}/${inputs.namespace}`

  core.startGroup(`checkout branch ${branch} if exist`)
  await git.init(workspace, owner, repo, inputs.token)
  await git.checkoutIfExist(workspace, branch)
  core.endGroup()

  const applicationAnnotations = [
    ...inputs.applicationAnnotations,
    `github.ref=${github.context.ref}`,
    `github.sha=${github.context.sha}`,
    `github.action=git-push-service`,
  ]

  core.startGroup(`arrange manifests into workspace ${workspace}`)
  await arrangeManifests({
    workspace,
    manifests,
    service: inputs.service,
    namespace: inputs.namespace,
    project,
    branch,
    applicationAnnotations,
    destinationRepository: inputs.destinationRepository,
  })
  core.endGroup()

  const status = await git.status(workspace)
  if (status === '') {
    core.info('nothing to commit')
    return
  }
  return await core.group(`push branch ${branch}`, async () => {
    const message = `Deploy ${inputs.namespace}/${inputs.service}\n\n${commitMessageFooter}`
    await git.commit(workspace, message)
    const code = await git.pushByFastForward(workspace, branch)
    if (code > 0) {
      return new Error(`failed to push branch ${branch} by fast-forward`)
    }
  })
}

const commitMessageFooter = [
  'git-push-service',
  `${github.context.payload.repository?.html_url ?? ''}/commit/${github.context.sha}`,
  `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`,
].join('\n')
