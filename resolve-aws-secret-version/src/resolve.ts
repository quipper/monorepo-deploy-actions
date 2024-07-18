import { promises as fs } from 'fs'
import * as core from '@actions/core'
import * as yaml from 'js-yaml'
import { assertKubernetesAWSSecret, isKubernetesObject } from './kubernetes'

interface AWSSecretsManager {
  getCurrentVersionId(secretId: string): Promise<string>
}

// resolve placeholders of AWSSecret to the current version IDs and write in-place
export const resolveInplace = async (inputManifestPath: string, manager: AWSSecretsManager): Promise<void> => {
  core.info(`reading ${inputManifestPath}`)
  const inputManifest = (await fs.readFile(inputManifestPath)).toString()
  const outputManifest = await resolve(inputManifest, manager)

  core.info(`writing to ${inputManifestPath}`)
  await fs.writeFile(inputManifestPath, outputManifest, { encoding: 'utf-8' })
}

// resolve placeholders of AWSSecret to the current version IDs
export const resolve = async (inputManifest: string, manager: AWSSecretsManager): Promise<string> => {
  const awsSecrets = findAWSSecrets(inputManifest)
  let resolved = inputManifest
  for (const awsSecret of awsSecrets) {
    core.info(`processing AWSSecret resource name=${awsSecret.name}, secretId=${awsSecret.secretId}`)
    const currentVersionId = await manager.getCurrentVersionId(awsSecret.secretId)
    core.info(`found the current version ${currentVersionId} for secret ${awsSecret.secretId}`)
    resolved = replaceAll(resolved, awsSecret.versionId, currentVersionId)
  }
  return resolved
}

const replaceAll = (s: string, oldString: string, newString: string): string => s.split(oldString).join(newString)

interface AWSSecret {
  name: string
  secretId: string
  versionId: string
}

// find all AWSSecret resources from a manifest string
const findAWSSecrets = (manifest: string): AWSSecret[] => {
  const secrets: AWSSecret[] = []
  const documents = yaml.loadAll(manifest)
  for (const d of documents) {
    if (!isKubernetesObject(d)) {
      continue
    }
    if (d.kind !== 'AWSSecret') {
      continue
    }
    core.info(`Parsing the AWSSecret: ${JSON.stringify(d)}`)
    assertKubernetesAWSSecret(d)

    const name = d.metadata.name
    const secretId = d.spec.stringDataFrom.secretsManagerSecretRef.secretId
    const versionId = d.spec.stringDataFrom.secretsManagerSecretRef.versionId
    if (!versionId.startsWith('${') || !versionId.endsWith('}')) {
      continue
    }
    secrets.push({ name, secretId, versionId })
  }
  return secrets
}
