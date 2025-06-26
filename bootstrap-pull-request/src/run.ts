import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git.js'
import * as prebuilt from './prebuilt.js'
import { retryExponential } from './retry.js'

type Inputs = {
  overlay: string
  namespace: string
  sourceRepository: string
  destinationRepository: string
  preserveServices: string[]
  sourceBranch: string
  overrideSourceBranch: string | undefined
  overrideServices: string[]
  destinationRepositoryToken: string
  substituteVariables: string[]
}

type Outputs = {
  services: prebuilt.Service[]
}

export const run = async (inputs: Inputs): Promise<Outputs> => {
  const outputs = await retryExponential(() => bootstrapNamespace(inputs), {
    maxAttempts: 50,
    waitMs: 10000,
  })
  return outputs
}

const bootstrapNamespace = async (inputs: Inputs): Promise<Outputs | Error> => {
  const [, sourceRepositoryName] = inputs.sourceRepository.split('/')
  const namespaceBranch = `ns/${sourceRepositoryName}/${inputs.overlay}/${inputs.namespace}`

  const sourceBranchDirectory = await checkoutPrebuiltBranch(inputs, inputs.sourceBranch)
  const overrideSourceBranchDirectory = inputs.overrideSourceBranch
    ? await checkoutPrebuiltBranch(inputs, inputs.overrideSourceBranch)
    : undefined
  const namespaceDirectory = await checkoutNamespaceBranch(inputs, namespaceBranch)

  const substituteVariables = parseSubstituteVariables(inputs.substituteVariables)

  const services = await prebuilt.syncServicesFromPrebuilt({
    overlay: inputs.overlay,
    namespace: inputs.namespace,
    sourceRepositoryName,
    destinationRepository: inputs.destinationRepository,
    preserveServices: inputs.preserveServices,
    sourceBranchDirectory,
    overrideSourceBranchDirectory,
    overrideServices: inputs.overrideServices,
    namespaceDirectory,
    substituteVariables,
  })

  if ((await git.status(namespaceDirectory)) === '') {
    core.info('Nothing to commit')
    return { services }
  }

  core.startGroup(`Pushing the namespace branch`)
  const commitSha = await git.commit(namespaceDirectory, commitMessage(inputs.namespace))
  const pushCode = await git.pushByFastForward(namespaceDirectory)
  if (pushCode > 0) {
    // Retry from checkout if fast-forward was failed
    return new Error(`git-push returned code ${pushCode}`)
  }
  core.endGroup()

  writeSummary(inputs, commitSha, services)
  await core.summary.write()
  return { services }
}

const checkoutPrebuiltBranch = async (inputs: Inputs, prebuiltBranch: string) => {
  return await core.group(
    `Checking out the prebuilt branch: ${prebuiltBranch}`,
    async () =>
      await git.checkout({
        repository: inputs.destinationRepository,
        branch: prebuiltBranch,
        token: inputs.destinationRepositoryToken,
      }),
  )
}

const checkoutNamespaceBranch = async (inputs: Inputs, namespaceBranch: string) => {
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

const writeSummary = (inputs: Inputs, commitSha: string, services: prebuilt.Service[]) => {
  core.summary.addHeading('bootstrap-pull-request summary', 2)

  const commitUrl = `${github.context.serverUrl}/${inputs.destinationRepository}/commit/${commitSha}`
  core.summary.addRaw('<p>')
  core.summary.addRaw('Pushed ')
  core.summary.addLink(commitSha, commitUrl)
  core.summary.addRaw(' to the namespace branch.')
  core.summary.addRaw('</p>')

  core.summary.addTable([
    [
      { data: 'Service', header: true },
      { data: 'Built from', header: true },
    ],
    ...services.map((service) => {
      if (service.builtFrom.pullRequest) {
        const shaLink = `<a href="${github.context.serverUrl}/${inputs.sourceRepository}/tree/${service.builtFrom.pullRequest.headSha}">${service.builtFrom.pullRequest.headSha}</a>`
        return [service.service, `Current pull request at ${shaLink}`]
      }
      if (service.builtFrom.prebuilt) {
        const shaLink = `<a href="${github.context.serverUrl}/${inputs.sourceRepository}/tree/${service.builtFrom.prebuilt.builtFrom.headSha}">${service.builtFrom.prebuilt.builtFrom.headSha}</a>`
        return [service.service, `${service.builtFrom.prebuilt.builtFrom.headRef}@${shaLink}`]
      }
      return [service.service, '(unknown)']
    }),
  ])
}

const commitMessage = (namespace: string) => `Bootstrap namespace ${namespace}
${github.context.action}
${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`
