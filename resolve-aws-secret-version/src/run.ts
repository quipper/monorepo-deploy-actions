import * as awsSecretsManager from './awsSecretsManager'
import { resolveAsTemporaryFile, resolveInplace } from './resolve'

type Inputs = {
  manifestPaths: string[]
  inPlace: boolean
}

type Outputs = {
  manifestPaths: string[]
}

export const run = async (inputs: Inputs): Promise<Outputs> => {
  const manifestPaths: string[] = []
  for (const manifest of inputs.manifestPaths) {
    if (inputs.inPlace) {
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
