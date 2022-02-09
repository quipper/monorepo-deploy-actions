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
    // Since both git-push-service and git-push-services-from-prebuilt are running concurrently,
    // don't overwrite a manifest to prebuilt.
    const applicationManifestPath = `${inputs.workspace}/applications/${inputs.namespace}--${service}.yaml`
    if (await exists(applicationManifestPath)) {
      core.info(`service ${service} already exists at ${applicationManifestPath}`)
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
        annotations: [
          `github.ref=${inputs.context.ref}`,
          `github.sha=${inputs.context.sha}`,
          'github.action=git-push-services-from-prebuilt',
        ],
      },
      inputs.workspace
    )
  }
}

const exists = async (f: string): Promise<boolean> => {
  try {
    await fs.access(f)
    return true
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const e = error as { code: string }
      if (e.code === 'ENOENT') {
        return false
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
