import { promises as fs } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as io from '@actions/io'
import { Application, generateApplicationManifest } from './application'
import { PathVariablesPattern } from './match'

type Inputs = {
  workspace: string
  manifests: string[]
  namespace: string
  service: Service
  project: string
  branch: string
  applicationAnnotations: string[]
  destinationRepository: string
  overwrite: boolean
  transient?: Transient
}

export type Service = PathVariablesPattern | string

export type Transient = { sha: string }

export const arrangeManifests = async (inputs: Inputs): Promise<string[]> => {
  await io.mkdirP(`${inputs.workspace}/applications`)

  const services = new Set<string>()
  for (const f of inputs.manifests) {
    const service = inferServiceFromPath(f, inputs.service)
    core.info(`add service ${service}`)
    services.add(service)

    const generatedManifestPath =
      inputs.transient !== undefined ? `sha/${inputs.transient.sha}/services/${service}` : `services/${service}`

    await copyGeneratedManifest(f, `${inputs.workspace}/${generatedManifestPath}`, inputs.overwrite)

    await putApplicationManifest(
      {
        name: `${inputs.namespace}--${service}`,
        project: inputs.project,
        source: {
          repository: inputs.destinationRepository,
          branch: inputs.branch,
          path: generatedManifestPath,
        },
        destination: {
          namespace: inputs.namespace,
        },
        annotations: inputs.applicationAnnotations,
      },
      inputs.workspace,
      inputs.overwrite
    )
  }
  return [...services]
}

const inferServiceFromPath = (f: string, s: Service): string => {
  if (typeof s === 'string') {
    return s
  }
  const n = s.match(f).get('service')
  if (n === undefined) {
    throw new Error(`could not determine service name from path ${f}`)
  }
  return n
}

const copyGeneratedManifest = async (source: string, destinationDir: string, overwrite: boolean) => {
  const destination = `${destinationDir}/${path.basename(source)}`
  if (!overwrite && (await exists(destination))) {
    core.info(`generated manifest already exists at ${destination}`)
    return
  }
  await io.mkdirP(destinationDir)
  await io.cp(source, destination)
}

const putApplicationManifest = async (application: Application, workspace: string, overwrite: boolean) => {
  const destination = `${workspace}/applications/${application.name}.yaml`
  if (!overwrite && (await exists(destination))) {
    core.info(`application manifest already exists at ${destination}`)
    return
  }
  core.info(`writing to ${destination}`)
  const content = generateApplicationManifest(application)
  await fs.writeFile(destination, content)
}

const exists = async (s: string): Promise<boolean> => {
  try {
    await fs.access(s)
    return true
  } catch (error) {
    return false
  }
}
