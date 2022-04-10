import { ListSecretVersionIdsCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'

// get the current version id for the secret
export const getCurrentVersionId = async (secretId: string): Promise<string> => {
  const client = new SecretsManagerClient({})
  const versionIds = await client.send(new ListSecretVersionIdsCommand({ SecretId: secretId }))
  if (versionIds.Versions === undefined) {
    throw new Error(`SecretsManager returned Versions=undefined for secret ${secretId}`)
  }
  const currentVersion = versionIds.Versions.find((version) =>
    version.VersionStages?.some((stage) => stage === 'AWSCURRENT')
  )
  if (currentVersion === undefined) {
    throw new Error(`no current version found for secret ${secretId}`)
  }
  if (currentVersion.VersionId === undefined) {
    throw new Error(`current versionId is undefined for secret ${secretId}`)
  }
  return currentVersion.VersionId
}
