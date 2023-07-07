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
  assertHasField(a, 'metadata')
  assertHasField(a.metadata, 'name')
  assert(typeof a.metadata.name === 'string', `metadata.name must be a string`)

  assertHasField(a, 'spec')
  assertHasField(a.spec, 'stringDataFrom')
  assertHasField(a.spec.stringDataFrom, 'secretsManagerSecretRef')

  assertHasField(a.spec.stringDataFrom.secretsManagerSecretRef, 'secretId')
  assert(
    typeof a.spec.stringDataFrom.secretsManagerSecretRef.secretId === 'string',
    'spec.stringDataFrom.secretsManagerSecretRef.secretId must be a string',
  )

  assertHasField(a.spec.stringDataFrom.secretsManagerSecretRef, 'versionId')
  assert(
    typeof a.spec.stringDataFrom.secretsManagerSecretRef.versionId === 'string',
    'spec.stringDataFrom.secretsManagerSecretRef.versionId must be a string',
  )
}

function assertHasField<K extends string>(o: unknown, key: K): asserts o is Record<K, unknown> {
  assert(typeof o === 'object' && o !== null, `must be an object`)
  assert(key in o, `must have ${key} field`)
}

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    throw new TypeError(`invalid AWSSecret: ${msg}`)
  }
}
