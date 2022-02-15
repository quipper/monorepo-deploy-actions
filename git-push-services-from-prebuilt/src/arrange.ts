import { promises as fs } from 'fs'
import * as core from '@actions/core'
import * as io from '@actions/io'
import { Application, generateApplicationManifest } from './application'

type Inputs = {
  workspace: string
  prebuiltDirectory: string
  namespace: string
  project: string
  branch: string
  context: {
    sha: string
    ref: string
  }
  destinationRepository: string
}

export const arrangeManifests = async (inputs: Inputs): Promise<void> => {
  await io.mkdirP(`${inputs.workspace}/applications`)
  await io.mkdirP(`${inputs.workspace}/services`)

  const prebuiltServicesDirectory = `${inputs.prebuiltDirectory}/services`
  const prebuiltServices = (await fs.readdir(prebuiltServicesDirectory, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)

  for (const service of prebuiltServices) {
    // Since git-push-service and git-push-services-from-prebuilt run concurrently,
    // don't overwrite if the service was pushed by git-push-service.
    //
    // If the service was pushed by git-push-services-from-prebuilt,
    // it needs to overwrite it to follow the latest manifest.
    if (await determineIfPushedByGitPushService(inputs.workspace, inputs.namespace, service)) {
      continue
    }

    core.info(`copy the generated manifest of service ${service}`)
    await io.cp(`${inputs.prebuiltDirectory}/services/${service}`, `${inputs.workspace}/services`, { recursive: true })

    await putApplicationManifest(
      {
        name: `${inputs.namespace}--${service}`,
        project: inputs.project,
        source: {
          repository: inputs.destinationRepository,
          branch: inputs.branch,
          path: `services/${service}`,
        },
        destination: {
          namespace: inputs.namespace,
        },
        annotations: ['github.action=git-push-services-from-prebuilt'],
      },
      inputs.workspace
    )
  }
}

const determineIfPushedByGitPushService = async (workspace: string, namespace: string, service: string) => {
  const applicationManifestPath = `${workspace}/applications/${namespace}--${service}.yaml`
  const applicationManifest = await readContent(applicationManifestPath)
  if (applicationManifest === undefined) {
    core.info(`application manifest ${applicationManifestPath} does not exist`)
    return false
  }

  if (applicationManifest.indexOf('github.action: git-push-services-from-prebuilt') > -1) {
    core.info(`application manifest ${applicationManifestPath} was pushed from prebuilt`)
    return false
  }

  core.info(`application manifest ${applicationManifestPath} was pushed from git-push-service`)
  return true
}

const readContent = async (f: string): Promise<string | undefined> => {
  try {
    const b = await fs.readFile(f)
    return b.toString()
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const e = error as { code: string }
      if (e.code === 'ENOENT') {
        return
      }
    }
    throw error
  }
}

const putApplicationManifest = async (application: Application, workspace: string) => {
  const destination = `${workspace}/applications/${application.name}.yaml`
  core.info(`writing to ${destination}`)
  const content = generateApplicationManifest(application)
  await fs.writeFile(destination, content)
}
