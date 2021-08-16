import * as glob from '@actions/glob'
import * as awsSecretsManager from './awsSecretsManager'
import { resolveInplace } from './resolve'

type Inputs = {
  manifests: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const manifests = await glob.create(inputs.manifests, { matchDirectories: false })
  for await (const manifest of manifests.globGenerator()) {
    await resolveInplace(manifest, awsSecretsManager)
  }
}
