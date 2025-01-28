import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git.js'
import * as prebuilt from './prebuilt.js'
import { retryExponential } from './retry.js'
import { writeNamespaceManifest } from './namespace.js'

type Inputs = {
  overlay: string
  namespace: string
  sourceRepository: string
  destinationRepository: string
  destinationRepositoryToken: string
  namespaceManifest: string | undefined
  substituteVariables: string[]
  currentHeadSha: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const services = await retryExponential(() => bootstrapNamespace(inputs), {
    maxAttempts: 50,
    waitMs: 10000,
  })
  core.summary.addHeading('bootstrap-pull-request summary', 2)
  if (services) {
    core.summary.addTable([
      [
        { data: 'Service', header: true },
        { data: 'Deployed commit', header: true },
      ],
      ...services.map((service) => [
        service.service,
        `[${service.headRef}@${service.headSha}](${github.context.serverUrl}/${inputs.sourceRepository}/commit/${service.headSha})`,
      ]),
    ])
  }
  await core.summary.write()
}

const bootstrapNamespace = async (inputs: Inputs): Promise<prebuilt.Service[] | void | Error> => {
  core.info(`Checking out the prebuilt branch`)
  const prebuiltDirectory = await checkoutPrebuiltBranch(inputs)
  core.info(`Checking out the namespace branch`)
  const namespaceDirectory = await checkoutNamespaceBranch(inputs)

  const substituteVariables = parseSubstituteVariables(inputs.substituteVariables)
  const [, sourceRepositoryName] = inputs.sourceRepository.split('/')

  const services = await prebuilt.syncServicesFromPrebuilt({
    currentHeadSha: inputs.currentHeadSha,
    overlay: inputs.overlay,
    namespace: inputs.namespace,
    sourceRepositoryName,
    destinationRepository: inputs.destinationRepository,
    prebuiltDirectory,
    namespaceDirectory,
    substituteVariables,
  })

  if (inputs.namespaceManifest) {
    await writeNamespaceManifest({
      namespaceManifest: inputs.namespaceManifest,
      namespaceDirectory,
      substituteVariables,
    })
  }

  if ((await git.status(namespaceDirectory)) === '') {
    core.info('Nothing to commit')
    return
  }
  await git.commit(namespaceDirectory, commitMessage(inputs.namespace))
  const pushCode = await git.pushByFastForward(namespaceDirectory)
  if (pushCode > 0) {
    // Retry from checkout if fast-forward was failed
    return new Error(`git-push returned code ${pushCode}`)
  }
  return services
}

const checkoutPrebuiltBranch = async (inputs: Inputs) => {
  const [, sourceRepositoryName] = inputs.sourceRepository.split('/')
  return await git.checkout({
    repository: inputs.destinationRepository,
    branch: `prebuilt/${sourceRepositoryName}/${inputs.overlay}`,
    token: inputs.destinationRepositoryToken,
  })
}

const checkoutNamespaceBranch = async (inputs: Inputs) => {
  const [, sourceRepositoryName] = inputs.sourceRepository.split('/')
  return await git.checkoutOrInitRepository({
    repository: inputs.destinationRepository,
    branch: `ns/${sourceRepositoryName}/${inputs.overlay}/${inputs.namespace}`,
    token: inputs.destinationRepositoryToken,
  })
}

const parseSubstituteVariables = (substituteVariables: string[]): Map<string, string> => {
  const m = new Map<string, string>()
  for (const s of substituteVariables) {
    const k = s.substring(0, s.indexOf('='))
    const v = s.substring(s.indexOf('=') + 1)
    m.set(k, v)
  }
  return m
}

const commitMessage = (namespace: string) => `Bootstrap namespace ${namespace}
${github.context.action}
${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`
