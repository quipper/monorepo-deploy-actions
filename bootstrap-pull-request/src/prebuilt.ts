import assert from 'assert'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as fs from 'fs/promises'
import * as io from '@actions/io'
import * as path from 'path'
import * as yaml from 'js-yaml'

type ApplicationContext = {
  overlay: string
  namespace: string
  project: string
  destinationRepository: string
}

type Inputs = {
  context: ApplicationContext
  preserveServices: string[]
  prebuiltBranch: string
  prebuiltDirectory: string
  overridePrebuiltBranchDirectory: string | undefined
  overrideServices: string[]
  namespaceDirectory: string
  substituteVariables: Map<string, string>
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
  await cleanupManifests(inputs)

  await copyServices({
    context: inputs.context,
    filterService: (service) => !inputs.preserveServices.includes(service),
    prebuiltBranch: inputs.prebuiltBranch,
    prebuiltDirectory: inputs.prebuiltDirectory,
    namespaceDirectory: inputs.namespaceDirectory,
    substituteVariables: inputs.substituteVariables,
  })

  if (inputs.overridePrebuiltBranchDirectory) {
    await copyServices({
      context: inputs.context,
      filterService: (service) =>
        !inputs.preserveServices.includes(service) && inputs.overrideServices.includes(service),
      prebuiltBranch: inputs.prebuiltBranch,
      prebuiltDirectory: inputs.overridePrebuiltBranchDirectory,
      namespaceDirectory: inputs.namespaceDirectory,
      substituteVariables: inputs.substituteVariables,
    })
  }

  return await listApplicationManifests(inputs.namespaceDirectory)
}

const cleanupManifests = async (inputs: Inputs): Promise<void> => {
  const patterns = [
    `${inputs.namespaceDirectory}/**`,
    ...inputs.preserveServices.map((service) => `!${inputs.namespaceDirectory}/applications/*--${service}.yaml`),
    ...inputs.preserveServices.map((service) => `!${inputs.namespaceDirectory}/services/${service}/*.yaml`),
    `!${inputs.namespaceDirectory}/.git/**`,
  ]
  core.info(`Cleaning up the manifests with patterns:\n${patterns.join('\n')}`)
  const globber = await glob.create(patterns.join('\n'), { matchDirectories: false })
  for await (const manifestPath of globber.globGenerator()) {
    core.info(`Deleting ${manifestPath}`)
    await io.rmRF(manifestPath)
  }
}

type CopyServicesInputs = {
  context: ApplicationContext
  filterService: (service: string) => boolean
  prebuiltBranch: string
  prebuiltDirectory: string
  namespaceDirectory: string
  substituteVariables: Map<string, string>
}

const copyServices = async (inputs: CopyServicesInputs): Promise<void> => {
  const prebuiltServices = await findPrebuiltServices(inputs.prebuiltDirectory)
  const filteredPrebuiltServices = prebuiltServices.filter((s) => inputs.filterService(s.service))
  for (const { service, application } of filteredPrebuiltServices) {
    core.info(`Service ${service}: copying from the branch ${inputs.prebuiltBranch}`)
    await copyManifests({
      fromDirectory: `${inputs.prebuiltDirectory}/services/${service}`,
      toDirectory: `${inputs.namespaceDirectory}/services/${service}`,
      substituteVariables: inputs.substituteVariables,
    })
    await writeApplicationManifest({
      context: inputs.context,
      service,
      namespaceDirectory: inputs.namespaceDirectory,
      prebuiltBranch: inputs.prebuiltBranch,
      prebuiltApplicationHeadRef: application.metadata.annotations['github.head-ref'],
      prebuiltApplicationHeadSha: application.metadata.annotations['github.head-sha'],
    })
  }
}

type PrebuiltService = {
  service: string
  application: PartialApplication
}

const findPrebuiltServices = async (prebuiltDirectory: string): Promise<PrebuiltService[]> => {
  const services = []
  const globber = await glob.create(`${prebuiltDirectory}/applications/*.yaml`, {
    matchDirectories: false,
  })
  for await (const manifestPath of globber.globGenerator()) {
    const application = await parseApplicationManifest(manifestPath)
    if (application instanceof Error) {
      const error: Error = application
      core.info(`Ignored an invalid application manifest: ${manifestPath}: ${String(error)}`)
      continue
    }
    if (!application.spec.source.path.startsWith('services/')) {
      core.info(`Ignored a non-service application manifest: ${manifestPath}`)
      continue
    }
    // Assumes that spec.source.path is in the form of "services/NAME".
    const service = path.basename(application.spec.source.path)
    services.push({
      service,
      application,
    })
  }
  return services
}

type WriteApplicationManifestInputs = {
  context: ApplicationContext
  service: string
  namespaceDirectory: string
  prebuiltBranch: string
  prebuiltApplicationHeadRef: string | undefined
  prebuiltApplicationHeadSha: string | undefined
}

const writeApplicationManifest = async (inputs: WriteApplicationManifestInputs) => {
  const destinationApplication = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: `${inputs.context.namespace}--${inputs.service}`,
      namespace: 'argocd',
      finalizers: ['resources-finalizer.argocd.argoproj.io'],
      annotations: {
        'github.action': 'bootstrap-pull-request',
        'github.head-ref': inputs.prebuiltApplicationHeadRef,
        'github.head-sha': inputs.prebuiltApplicationHeadSha,
        'built-from-prebuilt-branch': inputs.prebuiltBranch,
      },
    },
    spec: {
      project: inputs.context.project,
      source: {
        repoURL: `https://github.com/${inputs.context.destinationRepository}.git`,
        targetRevision: `ns/${inputs.context.project}/${inputs.context.overlay}/${inputs.context.namespace}`,
        path: `services/${inputs.service}`,
      },
      destination: {
        server: `https://kubernetes.default.svc`,
        namespace: inputs.context.namespace,
      },
      syncPolicy: {
        automated: {
          prune: true,
        },
      },
    },
  }

  const applicationManifestPath = `${inputs.namespaceDirectory}/applications/${inputs.context.namespace}--${inputs.service}.yaml`
  core.info(`Writing the application manifest: ${applicationManifestPath}`)
  await io.mkdirP(`${inputs.namespaceDirectory}/applications`)
  await fs.writeFile(applicationManifestPath, yaml.dump(destinationApplication))
}

type CopyManifestsInputs = {
  fromDirectory: string
  toDirectory: string
  substituteVariables: Map<string, string>
}

const copyManifests = async (inputs: CopyManifestsInputs) => {
  const globber = await glob.create(`${inputs.fromDirectory}/*.yaml`, {
    matchDirectories: false,
  })
  for await (const fromPath of globber.globGenerator()) {
    core.info(`Reading ${fromPath}`)
    let content = await fs.readFile(fromPath, 'utf-8')
    for (const [k, v] of inputs.substituteVariables) {
      const placeholder = '${' + k + '}'
      content = content.replaceAll(placeholder, v)
    }
    const toPath = `${inputs.toDirectory}/${path.basename(fromPath)}`
    core.info(`Writing ${toPath}`)
    await io.mkdirP(inputs.toDirectory)
    await fs.writeFile(toPath, content)
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
