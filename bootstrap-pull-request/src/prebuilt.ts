import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as fs from 'fs/promises'
import * as io from '@actions/io'
import * as path from 'path'
import * as yaml from 'js-yaml'
import { parseApplicationManifest } from './application.js'

type ApplicationContext = {
  overlay: string
  namespace: string
  project: string
  destinationRepository: string
}

type Inputs = {
  applicationContext: ApplicationContext
  preserveServices: string[]
  prebuiltBranch: {
    name: string
    directory: string
  }
  overrideServices: string[]
  overridePrebuiltBranch?: {
    name: string
    directory: string
  }
  namespaceDirectory: string
  substituteVariables: Map<string, string>
}

export const syncServicesFromPrebuilt = async (inputs: Inputs): Promise<Service[]> => {
  await cleanupManifests(inputs)

  await copyServices({
    applicationContext: inputs.applicationContext,
    filterService: (service) => !inputs.preserveServices.includes(service),
    prebuiltBranch: inputs.prebuiltBranch.name,
    prebuiltDirectory: inputs.prebuiltBranch.directory,
    namespaceDirectory: inputs.namespaceDirectory,
    substituteVariables: inputs.substituteVariables,
  })

  if (inputs.overridePrebuiltBranch) {
    await copyServices({
      applicationContext: inputs.applicationContext,
      filterService: (service) =>
        !inputs.preserveServices.includes(service) && inputs.overrideServices.includes(service),
      prebuiltBranch: inputs.overridePrebuiltBranch.name,
      prebuiltDirectory: inputs.overridePrebuiltBranch.directory,
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
  applicationContext: ApplicationContext
  filterService: (service: string) => boolean
  prebuiltBranch: string
  prebuiltDirectory: string
  namespaceDirectory: string
  substituteVariables: Map<string, string>
}

const copyServices = async (inputs: CopyServicesInputs): Promise<void> => {
  const prebuiltServices = await findPrebuiltServices(inputs.prebuiltDirectory)
  const filteredPrebuiltServices = prebuiltServices.filter((s) => inputs.filterService(s.service))
  for (const prebuiltService of filteredPrebuiltServices) {
    core.info(`Service ${prebuiltService.service}: copying from the branch ${inputs.prebuiltBranch}`)
    await writeServiceManifests({
      fromDirectory: `${inputs.prebuiltDirectory}/services/${prebuiltService.service}`,
      toDirectory: `${inputs.namespaceDirectory}/services/${prebuiltService.service}`,
      substituteVariables: inputs.substituteVariables,
    })
    await writeApplicationManifest({
      applicationContext: inputs.applicationContext,
      service: prebuiltService.service,
      namespaceDirectory: inputs.namespaceDirectory,
      prebuiltBranch: inputs.prebuiltBranch,
      prebuiltApplicationHeadRef: prebuiltService.applicationHeadRef,
      prebuiltApplicationHeadSha: prebuiltService.applicationHeadSha,
    })
  }
}

type PrebuiltService = {
  service: string
  applicationHeadRef: string | undefined
  applicationHeadSha: string | undefined
}

const findPrebuiltServices = async (prebuiltDirectory: string): Promise<PrebuiltService[]> => {
  const prebuiltServices = []
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
    prebuiltServices.push({
      service,
      applicationHeadRef: application.metadata.annotations['github.head-ref'],
      applicationHeadSha: application.metadata.annotations['github.head-sha'],
    })
  }
  return prebuiltServices
}

type WriteApplicationManifestInputs = {
  applicationContext: ApplicationContext
  service: string
  namespaceDirectory: string
  prebuiltBranch: string
  prebuiltApplicationHeadRef: string | undefined
  prebuiltApplicationHeadSha: string | undefined
}

const writeApplicationManifest = async (inputs: WriteApplicationManifestInputs) => {
  const applicationManifestPath = `${inputs.namespaceDirectory}/applications/${inputs.applicationContext.namespace}--${inputs.service}.yaml`
  core.info(`Writing the application manifest: ${applicationManifestPath}`)
  await io.mkdirP(`${inputs.namespaceDirectory}/applications`)
  const application = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: `${inputs.applicationContext.namespace}--${inputs.service}`,
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
  await fs.writeFile(applicationManifestPath, yaml.dump(application))
}

type WriteServiceManifestsInputs = {
  fromDirectory: string
  toDirectory: string
  substituteVariables: Map<string, string>
}

const writeServiceManifests = async (inputs: WriteServiceManifestsInputs) => {
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
