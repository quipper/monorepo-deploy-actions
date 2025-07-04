import * as core from '@actions/core'
import * as fs from 'fs/promises'
import * as github from './github.js'
import * as git from './git.js'
import * as path from 'path'
import * as prebuilt from './prebuilt.js'
import { retryExponential } from './retry.js'

type Inputs = {
  overlay: string
  namespace: string
  sourceRepository: string
  destinationRepository: string
  changedServices: string[]
  prebuiltBranch: string
  overridePrebuiltBranch: string | undefined
  overrideServices: string[]
  destinationRepositoryToken: string
  substituteVariables: string[]
}

type Outputs = {
  services: prebuilt.Service[]
}

export const run = async (inputs: Inputs, context: github.Context): Promise<Outputs> => {
  return await retryExponential(() => bootstrapNamespace(inputs, context), {
    maxAttempts: 50,
    waitMs: 10000,
  })
}

const bootstrapNamespace = async (inputs: Inputs, context: github.Context): Promise<Outputs | Error> => {
  core.startGroup(`Checking out the prebuilt branch: ${inputs.prebuiltBranch}`)
  const prebuiltDirectory = await createWorkspace(context, 'prebuilt-branch-')
  await git.checkout({
    workingDirectory: prebuiltDirectory,
    repository: inputs.destinationRepository,
    branch: inputs.prebuiltBranch,
    token: inputs.destinationRepositoryToken,
  })
  core.endGroup()

  let override
  if (inputs.overridePrebuiltBranch) {
    core.startGroup(`Checking out the override prebuilt branch: ${inputs.overridePrebuiltBranch}`)
    const overridePrebuiltDirectory = await createWorkspace(context, 'override-prebuilt-branch-')
    await git.checkout({
      workingDirectory: overridePrebuiltDirectory,
      repository: inputs.destinationRepository,
      branch: inputs.overridePrebuiltBranch,
      token: inputs.destinationRepositoryToken,
    })
    override = {
      services: inputs.overrideServices,
      prebuiltBranch: {
        name: inputs.overridePrebuiltBranch,
        directory: overridePrebuiltDirectory,
      },
    }
    core.endGroup()
  }

  const [, sourceRepositoryName] = inputs.sourceRepository.split('/')
  const namespaceBranch = `ns/${sourceRepositoryName}/${inputs.overlay}/${inputs.namespace}`
  core.startGroup(`Checking out the namespace branch: ${namespaceBranch}`)
  const namespaceDirectory = await createWorkspace(context, 'namespace-branch-')
  await git.checkoutOrInitRepository({
    workingDirectory: namespaceDirectory,
    repository: inputs.destinationRepository,
    branch: namespaceBranch,
    token: inputs.destinationRepositoryToken,
  })
  core.endGroup()

  const services = await prebuilt.syncServicesFromPrebuilt({
    applicationContext: {
      overlay: inputs.overlay,
      namespace: inputs.namespace,
      project: sourceRepositoryName,
      destinationRepository: inputs.destinationRepository,
    },
    changedServices: inputs.changedServices,
    prebuiltBranch: {
      name: inputs.prebuiltBranch,
      directory: prebuiltDirectory,
    },
    override,
    namespaceDirectory,
    substituteVariables: parseSubstituteVariables(inputs.substituteVariables),
  })

  if ((await git.status(namespaceDirectory)) === '') {
    core.info('Nothing to commit')
    return { services }
  }

  core.startGroup(`Pushing the namespace branch`)
  const commitSha = await git.commit(namespaceDirectory, commitMessage(context, inputs.namespace))
  const pushCode = await git.pushByFastForward(namespaceDirectory)
  if (pushCode > 0) {
    // Retry from checkout if fast-forward was failed
    return new Error(`git-push returned code ${pushCode}`)
  }
  core.endGroup()

  writeSummary(inputs, context, commitSha, services)
  await core.summary.write()
  return { services }
}

const createWorkspace = async (context: github.Context, prefix: string) =>
  await fs.mkdtemp(path.join(context.runnerTemp, prefix))

const parseSubstituteVariables = (substituteVariables: string[]): Map<string, string> => {
  const m = new Map<string, string>()
  for (const s of substituteVariables) {
    const k = s.substring(0, s.indexOf('='))
    const v = s.substring(s.indexOf('=') + 1)
    m.set(k, v)
  }
  return m
}

const writeSummary = (inputs: Inputs, context: github.Context, commitSha: string, services: prebuilt.Service[]) => {
  core.summary.addHeading('bootstrap-pull-request summary', 2)

  const commitUrl = `${context.serverUrl}/${inputs.destinationRepository}/commit/${commitSha}`
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
        const shaLink = `<a href="${context.serverUrl}/${inputs.sourceRepository}/tree/${service.builtFrom.pullRequest.headSha}">${service.builtFrom.pullRequest.headSha}</a>`
        return [service.service, `Current pull request at ${shaLink}`]
      }
      if (service.builtFrom.prebuilt) {
        const shaLink = `<a href="${context.serverUrl}/${inputs.sourceRepository}/tree/${service.builtFrom.prebuilt.builtFrom.headSha}">${service.builtFrom.prebuilt.builtFrom.headSha}</a>`
        return [service.service, `${service.builtFrom.prebuilt.builtFrom.headRef}@${shaLink}`]
      }
      return [service.service, '(unknown)']
    }),
  ])
}

const commitMessage = (context: github.Context, namespace: string) => `Bootstrap namespace ${namespace}
${context.action}
${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`
