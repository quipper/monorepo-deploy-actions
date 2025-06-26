import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git.js'
import * as prebuilt from './prebuilt.js'
import { retryExponential } from './retry.js'
import { getNamespaceBranch } from './namespace.js'

type Inputs = {
  overlay: string
  namespace: string
  sourceRepository: string
  destinationRepository: string
  prebuiltBranch: string | undefined
  destinationRepositoryToken: string
  substituteVariables: string[]
  currentHeadSha: string
  excludeServices: string[]
  invertExcludeServices: boolean
}

type Outputs = {
  services: prebuilt.Service[]
}

export const run = async (inputs: Inputs): Promise<Outputs> => {
  const outputs = await retryExponential(() => bootstrapNamespace(inputs), {
    maxAttempts: 50,
    waitMs: 10000,
  })
  writeSummary(inputs, outputs.services)
  await core.summary.write()
  return outputs
}

const bootstrapNamespace = async (inputs: Inputs): Promise<Outputs | Error> => {
  const [, sourceRepositoryName] = inputs.sourceRepository.split('/')
  // TODO: prebuiltBranch input will be required in the future release.
  if (inputs.prebuiltBranch === undefined) {
    core.warning('prebuilt-branch input will be required in the future release.')
  }
  const prebuiltBranch = inputs.prebuiltBranch ?? `prebuilt/${sourceRepositoryName}/${inputs.overlay}`

  const prebuiltDirectory = await checkoutPrebuiltBranch(inputs, prebuiltBranch)
  const namespaceDirectory = await checkoutNamespaceBranch(inputs)

  const substituteVariables = parseSubstituteVariables(inputs.substituteVariables)

  const services = await prebuilt.syncServicesFromPrebuilt({
    currentHeadSha: inputs.currentHeadSha,
    overlay: inputs.overlay,
    namespace: inputs.namespace,
    sourceRepositoryName,
    destinationRepository: inputs.destinationRepository,
    prebuiltBranch,
    prebuiltDirectory,
    namespaceDirectory,
    substituteVariables,
    excludeServices: inputs.excludeServices,
    invertExcludeServices: inputs.invertExcludeServices,
  })

  if ((await git.status(namespaceDirectory)) === '') {
    core.info('Nothing to commit')
    return { services }
  }
  return await core.group(`Pushing the namespace branch`, async () => {
    await git.commit(namespaceDirectory, commitMessage(inputs.namespace))
    const pushCode = await git.pushByFastForward(namespaceDirectory)
    if (pushCode > 0) {
      // Retry from checkout if fast-forward was failed
      return new Error(`git-push returned code ${pushCode}`)
    }
    return { services }
  })
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

  core.summary.addRaw('<p>')
  core.summary.addRaw('Pushed to the namespace branch: ')
  const namespaceBranch = getNamespaceBranch(inputs)
  const namespaceBranchUrl = `${github.context.serverUrl}/${inputs.destinationRepository}/tree/${namespaceBranch}`
  core.summary.addLink(namespaceBranchUrl, namespaceBranchUrl)
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
