import assert from 'node:assert'
import {
  ListSecretVersionIdsCommand,
  type ListSecretVersionIdsCommandOutput,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'

// get the current version id for the secret
export const getCurrentVersionId = async (secretId: string): Promise<string> => {
  const client = new SecretsManagerClient({})
  const listCommand = new ListSecretVersionIdsCommand({ SecretId: secretId })
  let listOutput: ListSecretVersionIdsCommandOutput
  try {
    listOutput = await client.send(listCommand)
  } catch (error) {
    throw new Error(`could not find the secret ${secretId} from AWS Secrets Manager: ${String(error)}`)
  }
  assert(listOutput.Versions !== undefined)
  const currentVersion = listOutput.Versions.find((version) =>
    version.VersionStages?.some((stage) => stage === 'AWSCURRENT'),
  )
  assert(currentVersion !== undefined)
  assert(currentVersion.VersionId !== undefined)
  return currentVersion.VersionId
}
