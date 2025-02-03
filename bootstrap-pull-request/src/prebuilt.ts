import assert from 'assert'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as fs from 'fs/promises'
import * as io from '@actions/io'
import * as path from 'path'
import * as yaml from 'js-yaml'

type Inputs = {
  currentHeadSha: string
  overlay: string
  namespace: string
  sourceRepositoryName: string
  destinationRepository: string
  prebuiltBranch: string
  prebuiltDirectory: string
  namespaceDirectory: string
  substituteVariables: Map<string, string>
  excludeServices: string[]
  invertExcludeServices: boolean
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

export const syncServicesFromPrebuilt = async (inputs: Inputs): Promise<Service[]> => {
  core.info(`Syncing from the prebuilt branch to the namespace branch`)
  await deleteOutdatedApplicationManifests(inputs)
  await writeServices(inputs)
  return await listApplicationManifests(inputs.namespaceDirectory)
}

const deleteOutdatedApplicationManifests = async (inputs: Inputs): Promise<void> => {
  const applicationManifestGlob = await glob.create(`${inputs.namespaceDirectory}/applications/**`, {
    matchDirectories: false,
  })
  for await (const applicationManifestPath of applicationManifestGlob.globGenerator()) {
    await deleteOutdatedApplicationManifest(
      applicationManifestPath,
      inputs.currentHeadSha,
      inputs.excludeServices,
      inputs.invertExcludeServices,
    )
  }
}

const shouldServiceExcluded = (service: string, excludeServices: string[], invertExcludeServices: boolean): boolean => {
  if (invertExcludeServices) {
    return !excludeServices.includes(service)
  }
  return excludeServices.includes(service)
}

const deleteOutdatedApplicationManifest = async (
  applicationManifestPath: string,
  currentHeadSha: string,
  excludeServices: string[],
  invertExcludeServices: boolean,
): Promise<void> => {
  const application = await parseApplicationManifest(applicationManifestPath)
  if (application instanceof Error) {
    // TODO ignore namespace.yaml

    const error: Error = application
    core.info(`Deleting the invalid application manifest: ${applicationManifestPath}: ${String(error)}`)
    await io.rmRF(applicationManifestPath)
    return
  }

  const service = path.basename(application.spec.source.path)

  if (shouldServiceExcluded(service, excludeServices, invertExcludeServices)) {
    core.info(`Preserving the application manifest: ${applicationManifestPath} because the service is excluded`)
    return
  }

  // bootstrap-pull-request action needs to be run after git-push-service action.
  // See https://github.com/quipper/monorepo-deploy-actions/pull/1763 for the details.
  if (application.metadata.annotations['github.action'] === 'git-push-service') {
    const service = path.basename(application.spec.source.path)

    if (shouldServiceExcluded(service, excludeServices, invertExcludeServices)) {
      core.info(`Preserving the application manifest: ${applicationManifestPath} because the service is excluded`)
      return
    }

    if (application.metadata.annotations['github.head-sha'] === currentHeadSha) {
      core.info(`Preserving the application manifest: ${applicationManifestPath}`)
      return
    }
    // For the backward compatibility.
    // Before https://github.com/quipper/monorepo-deploy-actions/pull/1768, the head SHA was not recorded.
    // When this action is called for an old pull request, we assume that the application manifest was pushed on the current commit.
    if (application.metadata.annotations['github.head-sha'] === undefined) {
      core.info(`Preserving the application manifest: ${applicationManifestPath}`)
      return
    }
  }

  core.info(`Deleting the outdated application manifest: ${applicationManifestPath}`)
  await io.rmRF(applicationManifestPath)
}

const writeServices = async (inputs: Inputs): Promise<void> => {
  const existingApplicationManifestPaths = await (
    await glob.create(`${inputs.namespaceDirectory}/applications/*.yaml`, { matchDirectories: false })
  ).glob()
  const prebuiltApplicationManifestPaths = await (
    await glob.create(`${inputs.prebuiltDirectory}/applications/*.yaml`, { matchDirectories: false })
  ).glob()
  for (const prebuiltApplicationManifestPath of prebuiltApplicationManifestPaths) {
    const prebuiltApplication = await parseApplicationManifest(prebuiltApplicationManifestPath)
    if (prebuiltApplication instanceof Error) {
      const error: Error = prebuiltApplication
      core.info(`Ignored an invalid application manifest: ${prebuiltApplicationManifestPath}: ${String(error)}`)
      continue
    }

    if (!prebuiltApplication.spec.source.path.startsWith('services/')) {
      core.info(`Ignored a non-service application manifest: ${prebuiltApplicationManifestPath}`)
      continue
    }
    const service = path.basename(prebuiltApplication.spec.source.path)
    core.info(
      `Found the service ${service} prebuilt from ${prebuiltApplication.metadata.annotations['github.head-sha']}`,
    )

    const namespaceApplicationManifestPath = `${inputs.namespaceDirectory}/applications/${inputs.namespace}--${service}.yaml`

    if (shouldServiceExcluded(service, inputs.excludeServices, inputs.invertExcludeServices)) {
      core.info(
        `Preserving the existing application manifest: ${namespaceApplicationManifestPath} because the service is excluded`,
      )
      continue
    }

    if (existingApplicationManifestPaths.includes(namespaceApplicationManifestPath)) {
      core.info(`Preserving the existing application manifest: ${namespaceApplicationManifestPath}`)
      continue
    }
    await writeService(inputs, service, prebuiltApplication)
  }
}

const writeService = async (inputs: Inputs, service: string, prebuiltApplication: PartialApplication) => {
  const applicationManifestPath = `${inputs.namespaceDirectory}/applications/${inputs.namespace}--${service}.yaml`
  core.info(`Writing the application manifest: ${applicationManifestPath}`)
  await io.mkdirP(`${inputs.namespaceDirectory}/applications`)
  const application = buildApplicationManifest(inputs, service, prebuiltApplication)
  await fs.writeFile(applicationManifestPath, yaml.dump(application))

  await writeServiceManifests(inputs, service)
}

const writeServiceManifests = async (inputs: Inputs, service: string) => {
  const filenames = (await fs.readdir(`${inputs.prebuiltDirectory}/services/${service}`, { withFileTypes: true }))
    .filter((e) => e.isFile())
    .map((e) => e.name)

  for (const filename of filenames) {
    const prebuiltPath = `${inputs.prebuiltDirectory}/services/${service}/${filename}`
    core.info(`Reading the prebuilt manifest: ${prebuiltPath}`)
    let content = await fs.readFile(prebuiltPath, 'utf-8')
    for (const [k, v] of inputs.substituteVariables) {
      const placeholder = '${' + k + '}'
      content = content.replaceAll(placeholder, v)
    }
    const namespacePath = `${inputs.namespaceDirectory}/services/${service}/${filename}`
    core.info(`Writing the service manifest: ${namespacePath}`)
    await io.mkdirP(`${inputs.namespaceDirectory}/services/${service}`)
    await fs.writeFile(namespacePath, content)
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

type PartialApplication = {
  metadata: {
    annotations: {
      'github.action': string
      'github.head-ref': string | undefined
      'github.head-sha': string | undefined
      'built-from-prebuilt-branch': string | undefined
    }
  }
  spec: {
    source: {
      path: string
    }
  }
}

function assertIsPartialApplication(o: unknown): asserts o is PartialApplication {
  assert(typeof o === 'object', 'must be an object')
  assert(o !== null, 'must not be null')
  assert('metadata' in o, 'must have metadata property')
  assert(typeof o.metadata === 'object', 'metadata must be an object')
  assert(o.metadata !== null, 'metadata must not be null')
  assert('annotations' in o.metadata, 'metadata must have annotations property')
  assert(typeof o.metadata.annotations === 'object', 'annotations must be an object')
  assert(o.metadata.annotations !== null, 'annotations must not be null')
  assert('github.action' in o.metadata.annotations, 'annotations must have github.action property')
  assert(typeof o.metadata.annotations['github.action'] === 'string', 'github.action must be a string')
  if ('github.head-ref' in o.metadata.annotations) {
    assert(typeof o.metadata.annotations['github.head-ref'] === 'string', 'github.head-ref must be a string')
  }
  if ('github.head-sha' in o.metadata.annotations) {
    assert(typeof o.metadata.annotations['github.head-sha'] === 'string', 'github.head-sha must be a string')
  }
  assert('spec' in o, 'must have spec property')
  assert(typeof o.spec === 'object', 'spec must be an object')
  assert(o.spec !== null, 'spec must not be null')
  assert('source' in o.spec, 'spec must have source property')
  assert(typeof o.spec.source === 'object', 'source must be an object')
  assert(o.spec.source !== null, 'source must not be null')
  assert('path' in o.spec.source, 'source must have path property')
  assert(typeof o.spec.source.path === 'string', 'path must be a string')
}

const parseApplicationManifest = async (applicationManifestPath: string): Promise<PartialApplication | Error> => {
  let application
  try {
    application = yaml.load(await fs.readFile(applicationManifestPath, 'utf-8'))
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      return error
    }
    throw error
  }
  try {
    assertIsPartialApplication(application)
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      return error
    }
    throw error
  }
  return application
}

const buildApplicationManifest = (inputs: Inputs, service: string, prebuiltApplication: PartialApplication) => {
  return {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: `${inputs.namespace}--${service}`,
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
      project: inputs.sourceRepositoryName,
      source: {
        repoURL: `https://github.com/${inputs.destinationRepository}.git`,
        targetRevision: `ns/${inputs.sourceRepositoryName}/${inputs.overlay}/${inputs.namespace}`,
        path: `services/${service}`,
      },
      destination: {
        server: `https://kubernetes.default.svc`,
        namespace: inputs.namespace,
      },
      syncPolicy: {
        automated: {
          prune: true,
        },
      },
    },
  }
}
