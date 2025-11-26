import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import * as core from '@actions/core'
import * as yaml from 'js-yaml'
import { assertKubernetesAWSSecret, assertKubernetesExternalSecret, isKubernetesObject } from './kubernetes.js'

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
    core.info(`Replacing ${awsSecret.versionIdPlaceholder} with the current versionId ${currentVersionId}`)
    resolved = resolved.replaceAll(awsSecret.versionIdPlaceholder, currentVersionId)
  }
  return resolved
}

type AWSSecret = {
  kind: string
  name: string
  secretId: string
  versionIdPlaceholder: string
}

const findAWSSecretsFromManifest = (manifest: string): AWSSecret[] => {
  const secrets: AWSSecret[] = []
  const documents = yaml.loadAll(manifest)
  for (const doc of documents) {
    if (!isKubernetesObject(doc)) {
      continue
    }

    if (doc.kind === 'AWSSecret') {
      try {
        assertKubernetesAWSSecret(doc)
      } catch (error) {
        if (error instanceof assert.AssertionError) {
          core.error(`Invalid AWSSecret object: ${JSON.stringify(doc)}`)
        }
        throw error
      }
      const versionIdPlaceholder = doc.spec.stringDataFrom.secretsManagerSecretRef.versionId
      if (!versionIdPlaceholder.startsWith('${') || !versionIdPlaceholder.endsWith('}')) {
        continue
      }
      secrets.push({
        kind: doc.kind,
        name: doc.metadata.name,
        secretId: doc.spec.stringDataFrom.secretsManagerSecretRef.secretId,
        versionIdPlaceholder,
      })
    } else if (doc.kind === 'ExternalSecret') {
      try {
        assertKubernetesExternalSecret(doc)
      } catch (error) {
        if (error instanceof assert.AssertionError) {
          core.error(`Invalid ExternalSecret object: ${JSON.stringify(doc)}`)
        }
        throw error
      }
      for (const dataFrom of doc.spec.dataFrom) {
        const version = dataFrom.extract.version
        if (!version.startsWith('uuid/${') || !version.endsWith('}')) {
          continue
        }
        const versionIdPlaceholder = version.substring('uuid/'.length)
        secrets.push({
          kind: doc.kind,
          name: doc.metadata.name,
          secretId: dataFrom.extract.key,
          versionIdPlaceholder,
        })
      }
    }
  }
  return secrets
}
