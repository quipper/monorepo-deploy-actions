import * as core from '@actions/core'
import * as io from '@actions/io'
import * as yaml from 'js-yaml'
import { promises as fs } from 'fs'

type Inputs = {
  overlay: string
  namespace: string
  sourceRepositoryName: string
  destinationRepository: string
  prebuiltDirectory: string
  namespaceDirectory: string
  substituteVariables: Map<string, string>
}

export const copyServicesFromPrebuilt = async (inputs: Inputs): Promise<void> => {
  core.info(`Finding services in ${inputs.prebuiltDirectory}/services`)
  const services = (await fs.readdir(`${inputs.prebuiltDirectory}/services`, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
  for (const service of services) {
    if (await shouldWriteService(inputs, service)) {
      core.info(`Writing the service manifest of ${service}`)
      await writeServiceManifest(inputs, service)
      core.info(`Writing the application manifest of ${service}`)
      await writeApplicationManifest(inputs, service)
    }
  }
}

const shouldWriteService = async (inputs: Inputs, service: string) => {
  const applicationManifestPath = `${inputs.namespaceDirectory}/applications/${inputs.namespace}--${service}.yaml`
  const applicationManifest = await readContentOrNull(applicationManifestPath)
  if (applicationManifest === null) {
    core.info(`Application manifest ${applicationManifestPath} does not exist`)
    return true
  }

  // If the service was pushed by git-push-service, don't overwrite it.
  if (/^ *github\.action: git-push-service$/m.test(applicationManifest)) {
    core.info(`Application manifest ${applicationManifestPath} was pushed by git-push-service action`)
    return false
  }

  // If the service was pushed by this action,
  // overwrite the service to follow the latest change of prebuilt branch.
  core.info(`Application manifest ${applicationManifestPath} was pushed by this action`)
  return true
}

const readContentOrNull = async (f: string): Promise<string | null> => {
  try {
    const b = await fs.readFile(f)
    return b.toString()
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const e = error as { code: string }
      if (e.code === 'ENOENT') {
        return null
      }
    }
    throw error
  }
}

const writeServiceManifest = async (inputs: Inputs, service: string) => {
  const filenames = (await fs.readdir(`${inputs.prebuiltDirectory}/services/${service}`, { withFileTypes: true }))
    .filter((e) => e.isFile())
    .map((e) => e.name)

  for (const filename of filenames) {
    const prebuiltPath = `${inputs.prebuiltDirectory}/services/${service}/${filename}`
    core.info(`Reading ${prebuiltPath}`)
    let content = (await fs.readFile(prebuiltPath)).toString()
    for (const [k, v] of inputs.substituteVariables) {
      const placeholder = '${' + k + '}'
      content = content.replaceAll(placeholder, v)
    }
    const namespacePath = `${inputs.namespaceDirectory}/services/${service}/${filename}`
    core.info(`Writing to ${namespacePath}`)
    await io.mkdirP(`${inputs.namespaceDirectory}/services/${service}`)
    await fs.writeFile(namespacePath, content)
  }
}

type ArgoCDApplication = {
  apiVersion: string
  kind: string
  metadata: {
    name: string
    namespace: string
    annotations?: { [key: string]: string }
    finalizers: string[]
  }
  spec: {
    project: string
    source: {
      repoURL: string
      targetRevision: string
      path: string
    }
    destination: {
      server: string
      namespace: string
    }
    syncPolicy: {
      automated: {
        prune: boolean
      }
    }
  }
}

const writeApplicationManifest = async (inputs: Inputs, service: string) => {
  const application: ArgoCDApplication = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: `${inputs.namespace}--${service}`,
      namespace: 'argocd',
      finalizers: ['resources-finalizer.argocd.argoproj.io'],
      annotations: { 'github.action': 'bootstrap-pull-request' },
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

  const destination = `${inputs.namespaceDirectory}/applications/${application.metadata.name}.yaml`
  core.info(`Writing to ${destination}`)
  await io.mkdirP(`${inputs.namespaceDirectory}/applications`)
  await fs.writeFile(destination, yaml.dump(application))
}
