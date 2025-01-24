import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from './git.js'
import { syncServicesFromPrebuilt } from './prebuilt.js'
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
}

export const run = async (inputs: Inputs): Promise<void> =>
  await retryExponential(() => bootstrapNamespace(inputs), {
    maxAttempts: 50,
    waitMs: 10000,
  })

const bootstrapNamespace = async (inputs: Inputs): Promise<void | Error> => {
  core.info(`Checking out the prebuilt branch`)
  const prebuiltDirectory = await checkoutPrebuiltBranch(inputs)
  core.info(`Checking out the namespace branch`)
  const namespaceDirectory = await checkoutNamespaceBranch(inputs)

  const substituteVariables = parseSubstituteVariables(inputs.substituteVariables)
  const [, sourceRepositoryName] = inputs.sourceRepository.split('/')

  await syncServicesFromPrebuilt({
    currentSha: github.context.sha,
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
