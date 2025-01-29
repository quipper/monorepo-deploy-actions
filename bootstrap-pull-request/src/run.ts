import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git.js'
import * as prebuilt from './prebuilt.js'
import { retryExponential } from './retry.js'
import { getNamespaceBranch, writeNamespaceManifest } from './namespace.js'

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
  if (services) {
    writeSummary(inputs, services)
  }
  await core.summary.write()
}

const bootstrapNamespace = async (inputs: Inputs): Promise<prebuilt.Service[] | void | Error> => {
  const prebuiltDirectory = await checkoutPrebuiltBranch(inputs)
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
  return await core.group(`Pushing the namespace branch`, async () => {
    await git.commit(namespaceDirectory, commitMessage(inputs.namespace))
    const pushCode = await git.pushByFastForward(namespaceDirectory)
    if (pushCode > 0) {
      // Retry from checkout if fast-forward was failed
      return new Error(`git-push returned code ${pushCode}`)
    }
    return services
  })
}

const checkoutPrebuiltBranch = async (inputs: Inputs) => {
  const [, sourceRepositoryName] = inputs.sourceRepository.split('/')
  const branch = `prebuilt/${sourceRepositoryName}/${inputs.overlay}`
  return await core.group(
    `Checking out the prebuilt branch: ${branch}`,
    async () =>
      await git.checkout({
        repository: inputs.destinationRepository,
        branch,
        token: inputs.destinationRepositoryToken,
      }),
  )
}

const checkoutNamespaceBranch = async (inputs: Inputs) => {
  const namespaceBranch = getNamespaceBranch(inputs)
  return await core.group(
    `Checking out the namespace branch: ${namespaceBranch}`,
    async () =>
      await git.checkoutOrInitRepository({
        repository: inputs.destinationRepository,
        branch: namespaceBranch,
        token: inputs.destinationRepositoryToken,
      }),
  )
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

const writeSummary = (inputs: Inputs, services: prebuilt.Service[]) => {
  core.summary.addHeading('bootstrap-pull-request summary', 2)

  core.summary.addRaw('Pushed to the namespace branch: ')
  const namespaceBranch = getNamespaceBranch(inputs)
  const namespaceBranchUrl = `${github.context.serverUrl}/${inputs.destinationRepository}/tree/ns/${namespaceBranch}`
  core.summary.addLink(namespaceBranchUrl, namespaceBranchUrl)
  core.summary.addEOL()

  core.summary.addTable([
    [
      { data: 'Service', header: true },
      { data: 'Source branch', header: true },
      { data: 'Source commit', header: true },
    ],
    ...services.map((service) => [
      service.service,
      service.headRef ?? '(unknown)',
      service.headSha
        ? `<a href="${github.context.serverUrl}/${inputs.sourceRepository}/tree/${service.headSha}">${service.headSha}</a>`
        : '(unknown)',
    ]),
  ])
}

const commitMessage = (namespace: string) => `Bootstrap namespace ${namespace}
${github.context.action}
${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`
