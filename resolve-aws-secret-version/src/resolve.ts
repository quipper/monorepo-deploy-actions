import * as fs from 'fs/promises'
import * as core from '@actions/core'
import * as yaml from 'js-yaml'
import { assertKubernetesAWSSecret, isKubernetesObject } from './kubernetes.js'
import assert from 'assert'

type AWSSecretsManager = {
  getCurrentVersionId(secretId: string): Promise<string>
}

export const updateManifest = async (manifestPath: string, manager: AWSSecretsManager): Promise<void> => {
  core.info(`Reading the manifest: ${manifestPath}`)
  const inputManifest = await fs.readFile(manifestPath, 'utf-8')
  const outputManifest = await replaceSecretVersionIds(inputManifest, manager)

  core.info(`Writing the manifest: ${manifestPath}`)
  await fs.writeFile(manifestPath, outputManifest, { encoding: 'utf-8' })
}

export const replaceSecretVersionIds = async (manifest: string, manager: AWSSecretsManager): Promise<string> => {
  const awsSecrets = findAWSSecretsFromManifest(manifest)
  let resolved = manifest
  for (const awsSecret of awsSecrets) {
    core.info(
      `Finding the current versionId of ${awsSecret.kind}: name=${awsSecret.name}, secretId=${awsSecret.secretId}`,
    )
    const currentVersionId = await manager.getCurrentVersionId(awsSecret.secretId)
    core.info(`Replacing ${awsSecret.versionId} with the current versionId ${currentVersionId}`)
    resolved = resolved.replaceAll(awsSecret.versionId, currentVersionId)
  }
  return resolved
}

type AWSSecret = {
  kind: string
  name: string
  secretId: string
  versionId: string
}

const findAWSSecretsFromManifest = (manifest: string): AWSSecret[] => {
  const secrets: AWSSecret[] = []
  const documents = yaml.loadAll(manifest)
  for (const doc of documents) {
    if (!isKubernetesObject(doc)) {
      continue
    }
    if (doc.kind !== 'AWSSecret') {
      continue
    }
    try {
      assertKubernetesAWSSecret(doc)
    } catch (error) {
      if (error instanceof assert.AssertionError) {
        core.error(`Invalid AWSSecret object: ${JSON.stringify(doc)}`)
      }
      throw error
    }
    const versionId = doc.spec.stringDataFrom.secretsManagerSecretRef.versionId
    if (!versionId.startsWith('${') || !versionId.endsWith('}')) {
      continue
    }

    secrets.push({
      kind: doc.kind,
      name: doc.metadata.name,
      secretId: doc.spec.stringDataFrom.secretsManagerSecretRef.secretId,
      versionId,
    })
  }
  return secrets
}
