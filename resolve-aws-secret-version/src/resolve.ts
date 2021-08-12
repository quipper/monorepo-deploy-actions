import * as os from 'os'
import { promises as fs } from 'fs'
import * as core from '@actions/core'
import * as yaml from 'js-yaml'

interface AWSSecretsManager {
  getCurrentVersionId(secretId: string): Promise<string>
}

// resolve placeholders of AWSSecret to the current version IDs and write the result to a temporary file
export const resolveAsTemporaryFile = async (
  inputManifestPath: string,
  manager: AWSSecretsManager
): Promise<string> => {
  core.info(`reading ${inputManifestPath}`)
  const inputManifest = (await fs.readFile(inputManifestPath)).toString()
  const outputManifest = await resolve(inputManifest, manager)

  const tempdir = await fs.mkdtemp(`${os.tmpdir()}/resolve-aws-secret-version-action-`)
  const outputManifestPath = `${tempdir}/resolved.yaml`
  core.info(`writing to ${outputManifestPath}`)
  await fs.writeFile(outputManifestPath, outputManifest, { encoding: 'utf-8' })
  return outputManifestPath
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
    if (!isKubernetesAWSSecret(d)) {
      core.warning(`kind is ${d.kind} but invalid object: ${JSON.stringify(d)}`)
      continue
    }

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

type KubernetesObject = {
  kind: string
}

const isKubernetesObject = (a: unknown): a is KubernetesObject => {
  if (typeof a !== 'object' || a === null) {
    return false
  }
  const c = a as KubernetesObject
  return typeof c.kind === 'string'
}

type KubernetesAWSSecret = KubernetesObject & {
  metadata: {
    name: string
  }
  spec: {
    stringDataFrom: {
      secretsManagerSecretRef: {
        secretId: string
        versionId: string
      }
    }
  }
}

const isKubernetesAWSSecret = (a: unknown): a is KubernetesAWSSecret => {
  if (!isKubernetesObject(a)) {
    return false
  }
  const c = a as KubernetesAWSSecret
  if (
    typeof c.metadata !== 'object' ||
    typeof c.metadata.name !== 'string' ||
    typeof c.spec !== 'object' ||
    typeof c.spec.stringDataFrom !== 'object' ||
    typeof c.spec.stringDataFrom.secretsManagerSecretRef !== 'object' ||
    typeof c.spec.stringDataFrom.secretsManagerSecretRef.secretId !== 'string' ||
    typeof c.spec.stringDataFrom.secretsManagerSecretRef.versionId !== 'string'
  ) {
    return false
  }
  return true
}
