import * as core from '@actions/core'
import * as io from '@actions/io'
import { promises as fs } from 'fs'
import { generateApplicationManifest } from './application'

type Inputs = {
  workspace: string
  overlay: string
  namespace: string
  project: string
  destinationRepository: string
}

export const addNamespace = async (r: Inputs): Promise<void> => {
  core.info(`add an application manifest for namespace ${r.namespace}`)
  const content = generateApplicationManifest({
    name: r.namespace,
    project: r.project,
    source: {
      repository: r.destinationRepository,
      branch: `ns/${r.project}/${r.overlay}/${r.namespace}`,
      path: 'applications',
    },
    destination: {
      namespace: 'default',
    },
  })
  const destination = `${r.workspace}/${r.project}/${r.overlay}/${r.namespace}.yaml`
  core.info(`writing to ${destination}`)
  await io.mkdirP(`${r.workspace}/${r.project}/${r.overlay}`)
  await fs.writeFile(destination, content)
}
