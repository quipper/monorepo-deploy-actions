import * as glob from '@actions/glob'
import * as awsSecretsManager from './awsSecretsManager.ts'
import { type AWSSecretsManager, updateManifest } from './resolve.ts'

type Inputs = {
  manifests: string
}

export const run = async (inputs: Inputs, manager: AWSSecretsManager = awsSecretsManager): Promise<void> => {
  const manifests = await glob.create(inputs.manifests, { matchDirectories: false })
  for await (const manifest of manifests.globGenerator()) {
    await updateManifest(manifest, manager)
  }
}
