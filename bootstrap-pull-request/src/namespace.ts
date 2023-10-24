import * as core from '@actions/core'
import * as io from '@actions/io'
import { promises as fs } from 'fs'

type Inputs = {
  namespaceManifest: string
  namespaceDirectory: string
  substituteVariables: Map<string, string>
}

export const writeNamespaceManifest = async (inputs: Inputs): Promise<void> => {
  core.info(`Reading ${inputs.namespaceManifest}`)
  let content = (await fs.readFile(inputs.namespaceManifest)).toString()
  for (const [k, v] of inputs.substituteVariables) {
    const placeholder = '${' + k + '}'
    content = content.replaceAll(placeholder, v)
  }

  const namespacePath = `${inputs.namespaceDirectory}/applications/namespace.yaml`
  core.info(`Writing to ${namespacePath}`)
  await io.mkdirP(`${inputs.namespaceDirectory}/applications`)
  await fs.writeFile(namespacePath, content)
}
