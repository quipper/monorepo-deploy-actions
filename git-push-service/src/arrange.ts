import { promises as fs } from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as io from '@actions/io'
import { Application, generateApplicationManifest } from './application'

type Inputs = {
  workspace: string
  manifests: string[]
  namespace: string
  service: string
  project: string
  branch: string
  applicationAnnotations: string[]
  destinationRepository: string
}

export const arrangeManifests = async (inputs: Inputs): Promise<string[]> => {
  await io.mkdirP(`${inputs.workspace}/applications`)

  const services = new Set<string>()
  for (const f of inputs.manifests) {
    core.info(`add service ${inputs.service}`)
    services.add(inputs.service)

    const generatedManifestPath = `services/${inputs.service}`

    await copyGeneratedManifest(f, `${inputs.workspace}/${generatedManifestPath}`)

    // Always overwrite an application manifest.
    // When a pull request is updated, an application manifest already exists and needs to be updated to the new sha.
    await putApplicationManifest(
      {
        name: `${inputs.namespace}--${inputs.service}`,
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
      inputs.workspace
    )
  }
  return [...services]
}

const copyGeneratedManifest = async (source: string, destinationDir: string) => {
  const destination = `${destinationDir}/${path.basename(source)}`
  await io.mkdirP(destinationDir)
  await io.cp(source, destination)
}

const putApplicationManifest = async (application: Application, workspace: string) => {
  const destination = `${workspace}/applications/${application.name}.yaml`
  core.info(`writing to ${destination}`)
  const content = generateApplicationManifest(application)
  await fs.writeFile(destination, content)
}
