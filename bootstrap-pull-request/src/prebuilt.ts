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
  prebuiltDirectory: string
  namespaceDirectory: string
  substituteVariables: Map<string, string>
}

export const syncServicesFromPrebuilt = async (inputs: Inputs): Promise<void> => {
  core.info(`Syncing from the prebuilt branch to the namespace branch`)
  await deleteOutdatedApplications(inputs)
  await writeServices(inputs)
}

const deleteOutdatedApplications = async (inputs: Inputs): Promise<void> => {
  const applicationManifestGlob = await glob.create(`${inputs.namespaceDirectory}/applications/**`, {
    matchDirectories: false,
  })
  for await (const applicationManifestPath of applicationManifestGlob.globGenerator()) {
    if (await isApplicationManifestPushedOnCurrentCommit(applicationManifestPath, inputs.currentHeadSha)) {
      core.info(`Preserving the application manifest: ${applicationManifestPath}`)
      continue
    }
    core.info(`Deleting the outdated application manifest: ${applicationManifestPath}`)
    await io.rmRF(applicationManifestPath)
  }
}

const isApplicationManifestPushedOnCurrentCommit = async (
  applicationManifestPath: string,
  currentHeadSha: string,
): Promise<boolean> => {
  const application = await parseApplicationManifest(applicationManifestPath)
  if (application instanceof Error) {
    const error: Error = application
    core.info(`Ignored an invalid application manifest: ${applicationManifestPath}: ${String(error)}`)
    return false
  }
  // bootstrap-pull-request action needs to be run after git-push-service action.
  // See https://github.com/quipper/monorepo-deploy-actions/pull/1763 for the details.
  if (application.metadata.annotations['github.action'] === 'git-push-service') {
    if (application.metadata.annotations['github.head-sha'] === currentHeadSha) {
      return true
    }
    // For the backward compatibility.
    // Before https://github.com/quipper/monorepo-deploy-actions/pull/1768, the head SHA was not recorded.
    // When this action is called for an old pull request, we assume that the application manifest was pushed on the current commit.
    if (application.metadata.annotations['github.head-sha'] === undefined) {
      return true
    }
  }
  return false
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

type PartialApplication = {
  metadata: {
    annotations: {
      'github.action': string
      'github.head-sha': string | undefined
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
        'github.head-sha': prebuiltApplication.metadata.annotations['github.head-sha'],
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
