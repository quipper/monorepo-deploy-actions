import assert from 'node:assert'

export type KubernetesObject = {
  kind: string
}

export const isKubernetesObject = (a: unknown): a is KubernetesObject =>
  typeof a === 'object' && a !== null && 'kind' in a && typeof a.kind === 'string'

export type KubernetesAWSSecret = KubernetesObject & {
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

export function assertKubernetesAWSSecret(a: KubernetesObject): asserts a is KubernetesAWSSecret {
  assertHasField(a, 'AWSSecret', 'metadata')
  assertHasField(a.metadata, 'AWSSecret', 'name')
  assert(typeof a.metadata.name === 'string', `metadata.name must be a string`)

  assertHasField(a, 'AWSSecret', 'spec')
  assertHasField(a.spec, 'AWSSecret', 'stringDataFrom')
  assertHasField(a.spec.stringDataFrom, 'AWSSecret', 'secretsManagerSecretRef')

  assertHasField(a.spec.stringDataFrom.secretsManagerSecretRef, 'AWSSecret', 'secretId')
  assert(typeof a.spec.stringDataFrom.secretsManagerSecretRef.secretId === 'string')

  assertHasField(a.spec.stringDataFrom.secretsManagerSecretRef, 'AWSSecret', 'versionId')
  assert(typeof a.spec.stringDataFrom.secretsManagerSecretRef.versionId === 'string')
}

export type KubernetesExternalSecret = KubernetesObject & {
  metadata: {
    name: string
  }
  spec: {
    dataFrom: {
      extract: {
        key: string
        version: string
      }
    }[]
  }
}

export function assertKubernetesExternalSecret(a: KubernetesObject): asserts a is KubernetesExternalSecret {
  assertHasField(a, 'ExternalSecret', 'metadata')
  assertHasField(a.metadata, 'ExternalSecret', 'name')
  assert(typeof a.metadata.name === 'string', `metadata.name must be a string`)

  assertHasField(a, 'ExternalSecret', 'spec')
  assertHasField(a.spec, 'ExternalSecret', 'dataFrom')
  assert(Array.isArray(a.spec.dataFrom), `spec.dataFrom.extract must be an array`)

  for (const dataFrom of a.spec.dataFrom) {
    assertHasField(dataFrom, 'ExternalSecret', 'extract')
    assertHasField(dataFrom.extract, 'ExternalSecret', 'key')
    assert(typeof dataFrom.extract.key === 'string', `spec.dataFrom.extract.key must be a string`)
    assertHasField(dataFrom.extract, 'ExternalSecret', 'version')
    assert(typeof dataFrom.extract.version === 'string', `spec.dataFrom.extract.version must be a string`)
  }
}

function assertHasField<K extends string>(o: unknown, kind: string, key: K): asserts o is Record<K, unknown> {
  assert(typeof o === 'object' && o !== null, `must be an object`)
  assert(key in o, `${kind} must have ${key} field`)
}
