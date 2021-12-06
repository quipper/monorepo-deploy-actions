import { promises as fs } from 'fs'
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

export const arrangeManifests = async (inputs: Inputs): Promise<void> => {
  await copyGeneratedManifest(inputs.manifests, `${inputs.workspace}/services/${inputs.service}`)

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
    inputs.workspace
  )
}

const copyGeneratedManifest = async (manifests: string[], destinationDir: string) => {
  await io.mkdirP(destinationDir)
  for (const f of manifests) {
    core.info(`copying ${f} to ${destinationDir}`)
    await io.cp(f, destinationDir)
  }
}

const putApplicationManifest = async (application: Application, workspace: string) => {
  await io.mkdirP(`${workspace}/applications`)
  const destination = `${workspace}/applications/${application.name}.yaml`
  core.info(`writing to ${destination}`)
  const content = generateApplicationManifest(application)
  await fs.writeFile(destination, content)
}
