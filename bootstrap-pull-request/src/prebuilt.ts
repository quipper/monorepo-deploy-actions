import assert from 'assert'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as fs from 'fs/promises'
import * as io from '@actions/io'
import * as path from 'path'
import * as yaml from 'js-yaml'

type Inputs = {
  overlay: string
  namespace: string
  sourceRepositoryName: string
  destinationRepository: string
  preserveServices: string[]
  overrideDirectory: string | undefined
  prebuiltBranch: string
  prebuiltDirectory: string
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
  core.info(`Syncing from the prebuilt branch to the namespace branch`)
  await cleanupManifests(inputs)
  await copyServicesFromPrebuilt(inputs)
  if (inputs.overrideDirectory) {
    await copyServicesFromOverride(inputs)
  }
  return await listApplicationManifests(inputs.namespaceDirectory)
}

const cleanupManifests = async (inputs: Inputs): Promise<void> => {
  const patterns = [
    `${inputs.namespaceDirectory}/**`,
    ...inputs.preserveServices.map((service) => `!${inputs.namespaceDirectory}/applications/*--${service}.yaml`),
    ...inputs.preserveServices.map((service) => `!${inputs.namespaceDirectory}/services/${service}/*.yaml`),
  ]
  const globber = await glob.create(patterns.join('\n'), { matchDirectories: false })
  for await (const manifestPath of globber.globGenerator()) {
    core.info(`Deleting ${manifestPath}`)
    await io.rmRF(manifestPath)
  }
}

const copyServicesFromPrebuilt = async (inputs: Inputs): Promise<void> => {
  const prebuiltGlobber = await glob.create(`${inputs.prebuiltDirectory}/applications/*.yaml`, {
    matchDirectories: false,
  })
  for await (const prebuiltApplicationManifestPath of prebuiltGlobber.globGenerator()) {
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
    if (inputs.preserveServices.includes(service)) {
      core.info(`Preserving the service ${service}`)
      continue
    }
    core.info(`Copying the service ${service} from the prebuilt branch`)
    await writeApplicationManifest(inputs, service, prebuiltApplication)
    await writeServiceManifests(inputs, service)
  }
}

const copyServicesFromOverride = async (inputs: Inputs): Promise<void> => {
  const overrideGlobber = await glob.create(`${inputs.overrideDirectory}/*/*.yaml`, {
    matchDirectories: false,
  })
  for await (const overrideManifestPath of overrideGlobber.globGenerator()) {
    const service = path.basename(path.dirname(overrideManifestPath))
    if (inputs.preserveServices.includes(service)) {
      core.info(`Preserving the service ${service} from override directory`)
      continue
    }

    const namespacePath = `${inputs.namespaceDirectory}/services/${service}/${path.basename(overrideManifestPath)}`
    core.info(`Copying ${overrideManifestPath} -> ${namespacePath}`)
    await io.mkdirP(`${inputs.namespaceDirectory}/services/${service}`)
    await io.cp(overrideManifestPath, namespacePath)

    await writeApplicationManifest(inputs, service, {
      metadata: {
        annotations: {
          'github.action': 'bootstrap-pull-request',
          'github.head-ref': undefined,
          'github.head-sha': undefined,
          'built-from-prebuilt-branch': undefined,
        },
      },
      spec: {
        source: {
          path: `services/${service}`,
        },
      },
    })
  }
}

const writeApplicationManifest = async (inputs: Inputs, service: string, prebuiltApplication: PartialApplication) => {
  const applicationManifestPath = `${inputs.namespaceDirectory}/applications/${inputs.namespace}--${service}.yaml`
  core.info(`Writing the application manifest: ${applicationManifestPath}`)
  await io.mkdirP(`${inputs.namespaceDirectory}/applications`)
  const application = buildApplicationManifest(inputs, service, prebuiltApplication)
  await fs.writeFile(applicationManifestPath, yaml.dump(application))
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
