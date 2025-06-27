import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as fs from 'fs/promises'
import * as io from '@actions/io'
import * as path from 'path'
import * as yaml from 'js-yaml'
import { parseApplicationManifest, PartialApplication } from './application.js'

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
  if (
    application.metadata.annotations['github.action'] === 'git-push-service' &&
    application.metadata.annotations['github.head-sha'] === currentHeadSha
  ) {
    core.info(`Preserving the application manifest: ${applicationManifestPath}`)
    return
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
  await writeApplicationManifest(inputs, service, prebuiltApplication)
  await writeServiceManifests(inputs, service)
}

const writeApplicationManifest = async (inputs: Inputs, service: string, prebuiltApplication: PartialApplication) => {
  const applicationManifestPath = `${inputs.namespaceDirectory}/applications/${inputs.namespace}--${service}.yaml`
  core.info(`Writing the application manifest: ${applicationManifestPath}`)
  await io.mkdirP(`${inputs.namespaceDirectory}/applications`)
  const application = {
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
