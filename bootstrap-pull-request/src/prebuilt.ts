import assert from 'assert'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as fs from 'fs/promises'
import * as io from '@actions/io'
import * as yaml from 'js-yaml'

type Inputs = {
  currentSha: string
  overlay: string
  namespace: string
  sourceRepositoryName: string
  destinationRepository: string
  prebuiltDirectory: string
  namespaceDirectory: string
  substituteVariables: Map<string, string>
}

export const syncServicesFromPrebuilt = async (inputs: Inputs): Promise<void> => {
  await deleteOutdatedApplications(inputs)
  await writeServices(inputs)
}

const deleteOutdatedApplications = async (inputs: Inputs): Promise<void> => {
  core.info(`Finding the application manifests in ${inputs.namespaceDirectory}/applications`)
  const applicationManifestGlob = await glob.create(`${inputs.namespaceDirectory}/applications/**`, {
    matchDirectories: false,
  })
  for await (const applicationManifestPath of applicationManifestGlob.globGenerator()) {
    if (await isApplicationManifestPushedOnCurrentCommit(applicationManifestPath, inputs.currentSha)) {
      core.info(`Preserving the application manifest pushed on the current commit: ${applicationManifestPath}`)
      continue
    }
    core.info(`Deleting the outdated application manifest: ${applicationManifestPath}`)
    await io.rmRF(applicationManifestPath)
  }
}

const isApplicationManifestPushedOnCurrentCommit = async (
  applicationManifestPath: string,
  currentSha: string,
): Promise<boolean> => {
  let application
  try {
    application = yaml.load(await fs.readFile(applicationManifestPath, 'utf-8'))
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      core.warning(`Invalid application manifest ${applicationManifestPath}: ${error.toString()}`)
      return false
    }
    throw error
  }
  try {
    assertIsPartialApplication(application)
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      core.info(`Invalid application manifest ${applicationManifestPath}: ${error.message}`)
      return false
    }
    throw error
  }

  // bootstrap-pull-request action needs to be run after git-push-service action.
  // See https://github.com/quipper/monorepo-deploy-actions/pull/1763 for the details.
  if (application.metadata.annotations['github.action'] === 'git-push-service') {
    if (application.metadata.annotations['github.head-sha'] === currentSha) {
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

type PartialApplication = {
  metadata: {
    annotations: {
      'github.action': string
      'github.head-sha': string | undefined
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
  assert('github.head-sha' in o.metadata.annotations, 'annotations must have github.head-sha property')
  if (o.metadata.annotations['github.head-sha'] !== undefined) {
    assert(typeof o.metadata.annotations['github.head-sha'] === 'string', 'github.head-sha must be a string')
  }
}

const writeServices = async (inputs: Inputs): Promise<void> => {
  const existingApplicationManifestPaths = await (
    await glob.create(`${inputs.namespaceDirectory}/applications/**`, { matchDirectories: false })
  ).glob()

  core.info(`Finding services in ${inputs.prebuiltDirectory}/services`)
  const services = (await fs.readdir(`${inputs.prebuiltDirectory}/services`, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
  for (const service of services) {
    const applicationManifestPath = `${inputs.namespaceDirectory}/applications/${inputs.namespace}--${service}.yaml`
    if (existingApplicationManifestPaths.includes(applicationManifestPath)) {
      core.info(`Service ${service} is already pushed`)
      continue
    }
    await writeServiceManifest(inputs, service)
    await writeApplicationManifest(inputs, service)
  }
}

const writeServiceManifest = async (inputs: Inputs, service: string) => {
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

const writeApplicationManifest = async (inputs: Inputs, service: string) => {
  const application = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: `${inputs.namespace}--${service}`,
      namespace: 'argocd',
      finalizers: ['resources-finalizer.argocd.argoproj.io'],
      annotations: {
        'github.action': 'bootstrap-pull-request',
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

  const applicationManifestPath = `${inputs.namespaceDirectory}/applications/${application.metadata.name}.yaml`
  core.info(`Writing the application manifest: ${applicationManifestPath}`)
  await io.mkdirP(`${inputs.namespaceDirectory}/applications`)
  await fs.writeFile(applicationManifestPath, yaml.dump(application))
}
