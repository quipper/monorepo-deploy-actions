import { promises as fs } from 'fs'
import * as core from '@actions/core'
import * as io from '@actions/io'
import * as path from 'path'
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

export const arrangeManifests = async (inputs: Inputs): Promise<void> => {
  return await arrangeServiceManifests(inputs)
}

const arrangeServiceManifests = async (inputs: Inputs): Promise<void> => {
  core.info(`arrange the manifests of the service`)
  await concatServiceManifests(inputs.manifests, `${inputs.workspace}/services/${inputs.service}/generated.yaml`)

  await putApplicationManifest(
    {
      name: `${inputs.namespace}--${inputs.service}`,
      project: inputs.project,
      source: {
        repository: inputs.destinationRepository,
        branch: inputs.branch,
        path: `services/${inputs.service}`,
      },
      destination: {
        namespace: inputs.namespace,
      },
      annotations: inputs.applicationAnnotations,
    },
    inputs.workspace,
  )
}

const concatServiceManifests = async (manifestPaths: string[], destinationPath: string) => {
  const manifestContents = await Promise.all(
    manifestPaths.map(async (manifestPath) => (await fs.readFile(manifestPath)).toString()),
  )
  const concatManifest = manifestContents.join('\n---\n')
  core.info(`writing to ${destinationPath}`)
  await io.mkdirP(path.dirname(destinationPath))
  await fs.writeFile(destinationPath, concatManifest)
}

const putApplicationManifest = async (application: Application, workspace: string) => {
  await io.mkdirP(`${workspace}/applications`)
  const destination = `${workspace}/applications/${application.name}.yaml`
  core.info(`writing to ${destination}`)
  const content = generateApplicationManifest(application)
  await fs.writeFile(destination, content)
}
