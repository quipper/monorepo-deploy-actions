import { promises as fs } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as io from '@actions/io'
import { generateApplicationManifest } from './application'
import { PathVariablesPattern } from './match'

type Inputs = {
  workspace: string
  manifests: string[]
  manifestsPattern: PathVariablesPattern
  namespace: string
  project: string
  branch: string
  destinationRepository: string
  overwrite: boolean
}

export const arrangeManifests = async (inputs: Inputs): Promise<void> => {
  await io.mkdirP(`${inputs.workspace}/applications`)

  for (const f of inputs.manifests) {
    // infer the service name from path
    const service = inputs.manifestsPattern.match(f).get('service')
    if (service === undefined) {
      throw new Error(`could not determine service name from path ${f}`)
    }
    core.info(`service ${service}`)

    await copyGeneratedManifest(f, inputs.workspace, service, inputs.overwrite)

    const applicationManifest = generateApplicationManifest({
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
    })
    await putApplicationManifest(applicationManifest, inputs.workspace, inputs.namespace, service, inputs.overwrite)
  }
}

const copyGeneratedManifest = async (source: string, workspace: string, service: string, overwrite: boolean) => {
  const destination = `${workspace}/services/${service}/${path.basename(source)}`
  if (!overwrite && (await exists(destination))) {
    core.info(`generated manifest already exists at ${destination}`)
    return
  }
  await io.mkdirP(`${workspace}/services/${service}`)
  await io.cp(source, destination)
}

const putApplicationManifest = async (
  content: string,
  workspace: string,
  namespace: string,
  service: string,
  overwrite: boolean
) => {
  const applicationManifestPath = `${workspace}/applications/${namespace}--${service}.yaml`
  if (!overwrite && (await exists(applicationManifestPath))) {
    core.info(`application manifest already exists at ${applicationManifestPath}`)
    return
  }
  core.info(`writing to ${applicationManifestPath}`)
  await fs.writeFile(applicationManifestPath, content)
}

const exists = async (s: string): Promise<boolean> => {
  try {
    await fs.access(s)
    return true
  } catch (error) {
    return false
  }
}
