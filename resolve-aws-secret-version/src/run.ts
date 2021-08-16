import * as glob from '@actions/glob'
import * as awsSecretsManager from './awsSecretsManager'
import { resolveAsTemporaryFile, resolveInplace } from './resolve'

type Inputs = {
  manifests: string
  writeInPlace: boolean
}

type Outputs = {
  manifestPaths: string[]
}

export const run = async (inputs: Inputs): Promise<Outputs> => {
  const manifests = await glob.create(inputs.manifests, { matchDirectories: false })
  const manifestPaths: string[] = []
  for await (const manifest of manifests.globGenerator()) {
    if (inputs.writeInPlace) {
      await resolveInplace(manifest, awsSecretsManager)
      manifestPaths.push(manifest)
    } else {
      manifestPaths.push(await resolveAsTemporaryFile(manifest, awsSecretsManager))
    }
  }
  return {
    manifestPaths,
  }
}
