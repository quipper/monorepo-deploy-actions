import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as io from '@actions/io'
import * as yaml from 'js-yaml'
import { parseApplicationManifest } from './application.js'

type ApplicationContext = {
  overlay: string
  namespace: string
  project: string
  destinationRepository: string
}

export type Inputs = {
  applicationContext: ApplicationContext
  namespaceDirectory: string
  changedServices: string[]
  prebuiltBranch: {
    name: string
    directory: string
    // This flag does not affect the override prebuilt branch,
    // because a manifest of override prebuilt branch is typically too large.
    aggregateToNamespaceDirectory: boolean
  }
  override?: {
    services: string[]
    prebuiltBranch: {
      name: string
      directory: string
    }
  }
  substituteVariables: Map<string, string>
}

export const syncServicesFromPrebuilt = async (inputs: Inputs): Promise<Service[]> => {
  await cleanupManifests(inputs)

  await copyServiceManifestsFromPrebuiltBranch(inputs)
  await copyApplicationManifestsFromPrebuiltBranch(inputs)
  await copyServiceManifestsFromOverridePrebuiltBranch(inputs)
  await copyApplicationManifestsFromOverridePrebuiltBranch(inputs)

  return await listApplicationManifests(inputs.namespaceDirectory)
}

const cleanupManifests = async (inputs: Inputs): Promise<void> => {
  const patterns = [
    `${inputs.namespaceDirectory}/**`,
    // Keep the changed services.
    // These should be deployed by other workflows.
    ...inputs.changedServices.map((service) => `!${inputs.namespaceDirectory}/applications/*--${service}.yaml`),
    ...inputs.changedServices.map((service) => `!${inputs.namespaceDirectory}/services/${service}/*.yaml`),
    // Keep the .git directory.
    `!${inputs.namespaceDirectory}/.git/**`,
  ]
  core.info(`Cleaning up the manifests with patterns:\n${patterns.join('\n')}`)
  const globber = await glob.create(patterns.join('\n'), { matchDirectories: false })
  for await (const manifestPath of globber.globGenerator()) {
    core.info(`Deleting ${manifestPath}`)
    await io.rmRF(manifestPath)
  }
}

const copyServiceManifestsFromPrebuiltBranch = async (inputs: Inputs) => {
  const patterns = [
    `${inputs.prebuiltBranch.directory}/services/*/*.yaml`,
    // Do not overwrite the changed services.
    ...inputs.changedServices.map((service) => `!${inputs.prebuiltBranch.directory}/services/${service}/*.yaml`),
  ]
  core.info(`Copying the service manifests with patterns:\n${patterns.join('\n')}`)
  const globber = await glob.create(patterns.join('\n'), { matchDirectories: false })
  for await (const prebuiltServiceManifestPath of globber.globGenerator()) {
    const service = path.basename(path.dirname(prebuiltServiceManifestPath))
    if (inputs.prebuiltBranch.aggregateToNamespaceDirectory) {
      core.info(`Copying the service manifest of ${service} into applications`)
      await copyServiceManifest(
        prebuiltServiceManifestPath,
        `${inputs.namespaceDirectory}/applications/${inputs.applicationContext.namespace}--${service}--${path.basename(prebuiltServiceManifestPath)}`,
        inputs.substituteVariables,
      )
    } else {
      core.info(`Copying the service manifest of ${service} into services`)
      await copyServiceManifest(
        prebuiltServiceManifestPath,
        `${inputs.namespaceDirectory}/services/${service}/${path.basename(prebuiltServiceManifestPath)}`,
        inputs.substituteVariables,
      )
    }
  }
}

const copyServiceManifestsFromOverridePrebuiltBranch = async (inputs: Inputs) => {
  const override = inputs.override
  if (override === undefined) {
    return
  }
  const patterns = [
    ...override.services.map((service) => `${override.prebuiltBranch.directory}/services/${service}/*.yaml`),
    // Do not overwrite the changed services.
    ...inputs.changedServices.map((service) => `!${override.prebuiltBranch.directory}/services/${service}/*.yaml`),
  ]
  core.info(`Copying the service manifests with patterns:\n${patterns.join('\n')}`)
  const globber = await glob.create(patterns.join('\n'), { matchDirectories: false })
  for await (const prebuiltServiceManifestPath of globber.globGenerator()) {
    const service = path.basename(path.dirname(prebuiltServiceManifestPath))
    core.info(`Copying the service manifest of ${service}`)
    await copyServiceManifest(
      prebuiltServiceManifestPath,
      `${inputs.namespaceDirectory}/services/${service}/${path.basename(prebuiltServiceManifestPath)}`,
      inputs.substituteVariables,
    )
  }
}

const copyServiceManifest = async (from: string, to: string, substituteVariables: Map<string, string>) => {
  core.info(`Reading ${from}`)
  let content = await fs.readFile(from, 'utf-8')
  for (const [k, v] of substituteVariables) {
    const placeholder = `\${${k}}`
    content = content.replaceAll(placeholder, v)
  }
  core.info(`Writing ${to}`)
  await io.mkdirP(path.dirname(to))
  await fs.writeFile(to, content)
}

const copyApplicationManifestsFromPrebuiltBranch = async (inputs: Inputs) => {
  if (inputs.prebuiltBranch.aggregateToNamespaceDirectory) {
    return
  }
  const patterns = [
    `${inputs.prebuiltBranch.directory}/applications/*--*.yaml`,
    // Do not overwrite the changed services.
    ...inputs.changedServices.map((service) => `!${inputs.prebuiltBranch.directory}/applications/*--${service}.yaml`),
  ]
  core.info(`Copying the application manifests with patterns:\n${patterns.join('\n')}`)
  const globber = await glob.create(patterns.join('\n'), { matchDirectories: false })
  for await (const prebuiltApplicationManifestPath of globber.globGenerator()) {
    const serviceMatcher = path.basename(prebuiltApplicationManifestPath).match(/--(.+?)\.yaml$/)
    assert(serviceMatcher, `Path ${prebuiltApplicationManifestPath} must be of the form NAMESPACE--SERVICE.yaml`)
    const service = serviceMatcher[1]
    core.info(`Copying the application manifest of ${service}`)
    await writeApplicationManifest({
      service,
      applicationContext: inputs.applicationContext,
      namespaceDirectory: inputs.namespaceDirectory,
      prebuiltBranch: inputs.prebuiltBranch.name,
      prebuiltApplicationManifestPath,
    })
  }
}

const copyApplicationManifestsFromOverridePrebuiltBranch = async (inputs: Inputs) => {
  const override = inputs.override
  if (override === undefined) {
    return
  }
  const patterns = [
    ...override.services.map((service) => `${override.prebuiltBranch.directory}/applications/*--${service}.yaml`),
    // Do not overwrite the changed services.
    ...inputs.changedServices.map((service) => `!${override.prebuiltBranch.directory}/applications/*--${service}.yaml`),
  ]
  core.info(`Copying the application manifests with patterns:\n${patterns.join('\n')}`)
  const globber = await glob.create(patterns.join('\n'), { matchDirectories: false })
  for await (const prebuiltApplicationManifestPath of globber.globGenerator()) {
    const serviceMatcher = path.basename(prebuiltApplicationManifestPath).match(/--(.+?)\.yaml$/)
    assert(serviceMatcher, `Path ${prebuiltApplicationManifestPath} must be of the form NAMESPACE--SERVICE.yaml`)
    const service = serviceMatcher[1]
    core.info(`Copying the application manifest of ${service}`)
    await writeApplicationManifest({
      service,
      applicationContext: inputs.applicationContext,
      namespaceDirectory: inputs.namespaceDirectory,
      prebuiltBranch: override.prebuiltBranch.name,
      prebuiltApplicationManifestPath,
    })
  }
}

type WriteApplicationManifestInputs = {
  service: string
  applicationContext: ApplicationContext
  namespaceDirectory: string
  prebuiltBranch: string
  prebuiltApplicationManifestPath: string
}

const writeApplicationManifest = async (inputs: WriteApplicationManifestInputs) => {
  const prebuiltApplication = await parseApplicationManifest(inputs.prebuiltApplicationManifestPath)
  if (prebuiltApplication instanceof Error) {
    const error: Error = prebuiltApplication
    core.info(`Ignored an invalid application manifest: ${inputs.prebuiltApplicationManifestPath}: ${String(error)}`)
    return
  }

  const application = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: `${inputs.applicationContext.namespace}--${inputs.service}`,
      namespace: 'argocd',
      finalizers: ['resources-finalizer.argocd.argoproj.io'],
      annotations: {
        'github.action': 'bootstrap-pull-request',
        'github.head-ref': prebuiltApplication.metadata.annotations['github.head-ref'],
        'github.head-sha': prebuiltApplication.metadata.annotations['github.head-sha'],
        'built-from-prebuilt-branch': inputs.prebuiltBranch,
      },
    },
    spec: {
      project: inputs.applicationContext.project,
      source: {
        repoURL: `https://github.com/${inputs.applicationContext.destinationRepository}.git`,
        targetRevision: `ns/${inputs.applicationContext.project}/${inputs.applicationContext.overlay}/${inputs.applicationContext.namespace}`,
        path: `services/${inputs.service}`,
      },
      destination: {
        server: `https://kubernetes.default.svc`,
        namespace: inputs.applicationContext.namespace,
      },
      syncPolicy: {
        automated: {
          prune: true,
        },
      },
    },
  }
  const applicationManifestPath = `${inputs.namespaceDirectory}/applications/${inputs.applicationContext.namespace}--${inputs.service}.yaml`
  core.info(`Writing the application manifest: ${applicationManifestPath}`)
  await io.mkdirP(`${inputs.namespaceDirectory}/applications`)
  await fs.writeFile(applicationManifestPath, yaml.dump(application))
}

export type Service = {
  service: string
  builtFrom: {
    // Available if the service was built from the current pull request.
    pullRequest?: {
      headRef: string | undefined
      headSha: string | undefined
    }
    // Available if the service was built from the prebuilt branch.
    prebuilt?: {
      prebuiltBranch: string | undefined
      builtFrom: {
        headRef: string | undefined
        headSha: string | undefined
      }
    }
  }
}

const listApplicationManifests = async (namespaceDirectory: string): Promise<Service[]> => {
  const services: Service[] = []
  const applicationManifestGlob = await glob.create(`${namespaceDirectory}/applications/*.yaml`, {
    matchDirectories: false,
  })
  for await (const applicationManifestPath of applicationManifestGlob.globGenerator()) {
    const application = await parseApplicationManifest(applicationManifestPath)
    if (application instanceof Error) {
      continue
    }
    const service = path.basename(application.spec.source.path)
    switch (application.metadata.annotations['github.action']) {
      case 'git-push-service':
        services.push({
          service,
          builtFrom: {
            pullRequest: {
              headRef: application.metadata.annotations['github.head-ref'],
              headSha: application.metadata.annotations['github.head-sha'],
            },
          },
        })
        break
      case 'bootstrap-pull-request':
        services.push({
          service,
          builtFrom: {
            prebuilt: {
              prebuiltBranch: application.metadata.annotations['built-from-prebuilt-branch'],
              builtFrom: {
                headRef: application.metadata.annotations['github.head-ref'],
                headSha: application.metadata.annotations['github.head-sha'],
              },
            },
          },
        })
        break
    }
  }
  return services
}
