import assert from 'node:assert'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import { it, mock } from 'node:test'
import { replaceSecretVersionIds, updateManifest } from '../src/resolve.ts'

it('replaces the placeholder of AWSSecret with the current version id', async () => {
  const manager = { getCurrentVersionId: mock.fn(async () => 'c7ea50c5-b2be-4970-bf90-2237bef3b4cf') }

  const tempdir = await fs.mkdtemp(`${os.tmpdir()}/resolve-aws-secret-version-action-`)
  const fixtureFile = `${tempdir}/fixture.yaml`
  await fs.copyFile(`${import.meta.dirname}/fixtures/input-with-awssecret-placeholder.yaml`, fixtureFile)

  await updateManifest(fixtureFile, manager)
  const output = (await fs.readFile(fixtureFile)).toString()
  const expected = (
    await fs.readFile(`${import.meta.dirname}/fixtures/expected-with-awssecret-placeholder.yaml`)
  ).toString()
  assert.strictEqual(output, expected)
})

it('replaces the placeholder of ExternalSecret with the current version id', async () => {
  const manager = { getCurrentVersionId: mock.fn(async () => 'c7ea50c5-b2be-4970-bf90-2237bef3b4cf') }

  const tempdir = await fs.mkdtemp(`${os.tmpdir()}/resolve-aws-secret-version-action-`)
  const fixtureFile = `${tempdir}/fixture.yaml`
  await fs.copyFile(`${import.meta.dirname}/fixtures/input-with-externalsecret-placeholder.yaml`, fixtureFile)

  await updateManifest(fixtureFile, manager)
  const output = (await fs.readFile(fixtureFile)).toString()
  const expected = (
    await fs.readFile(`${import.meta.dirname}/fixtures/expected-with-externalsecret-placeholder.yaml`)
  ).toString()
  assert.strictEqual(output, expected)
})

it('does nothing for an empty string', async () => {
  const manager = { getCurrentVersionId: mock.fn<(secretId: string) => Promise<string>>() }
  const output = await replaceSecretVersionIds('', manager)
  assert.strictEqual(output, '')
})

it('does nothing for an AWSSecret without a placeholder', async () => {
  const manager = { getCurrentVersionId: mock.fn<(secretId: string) => Promise<string>>() }
  const manifest = `---
apiVersion: mumoshu.github.io/v1alpha1
kind: AWSSecret
metadata:
  name: docker-hub
  namespace: \${NAMESPACE}
spec:
  stringDataFrom:
    secretsManagerSecretRef:
      secretId: docker-hub-credentials
      versionId: 2eb0efcf-14ee-4526-b8ce-971ec82b3aca
  type: kubernetes.io/dockerconfigjson
`
  const output = await replaceSecretVersionIds(manifest, manager)
  assert.strictEqual(output, manifest)
})

it('throws an error if invalid AWSSecret', async () => {
  const manager = { getCurrentVersionId: mock.fn<(secretId: string) => Promise<string>>() }
  const manifest = `---
apiVersion: mumoshu.github.io/v1alpha1
kind: AWSSecret
metadata:
  name: docker-hub
spec:
  stringDataFrom:
    secretsManagerSecretRef:
      secretId: this-has-no-versionId-field
`
  await assert.rejects(replaceSecretVersionIds(manifest, manager), { message: /AWSSecret must have versionId field/ })
})
