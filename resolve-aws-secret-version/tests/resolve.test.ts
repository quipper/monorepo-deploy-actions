import { promises as fs } from 'fs'
import * as os from 'os'
import { replaceSecretVersionIds, updateManifest } from '../src/resolve.js'

it('replaces the placeholder with the current version id', async () => {
  const manager = { getCurrentVersionId: jest.fn() }
  manager.getCurrentVersionId.mockResolvedValue('c7ea50c5-b2be-4970-bf90-2237bef3b4cf')

  const tempdir = await fs.mkdtemp(`${os.tmpdir()}/resolve-aws-secret-version-action-`)
  const fixtureFile = `${tempdir}/fixture.yaml`
  await fs.copyFile(`${__dirname}/fixtures/input-with-awssecret-placeholder.yaml`, fixtureFile)

  await updateManifest(fixtureFile, manager)
  const output = (await fs.readFile(fixtureFile)).toString()
  const expected = (await fs.readFile(`${__dirname}/fixtures/expected-with-awssecret-placeholder.yaml`)).toString()
  expect(output).toBe(expected)
})

it('does nothing for an empty string', async () => {
  const manager = { getCurrentVersionId: jest.fn() }
  const output = await replaceSecretVersionIds('', manager)
  expect(output).toBe('')
})

it('does nothing for an AWSSecret without a placeholder', async () => {
  const manager = { getCurrentVersionId: jest.fn() }
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
  expect(output).toBe(manifest)
})

it('throws an error if invalid AWSSecret', async () => {
  const manager = { getCurrentVersionId: jest.fn() }
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
  await expect(replaceSecretVersionIds(manifest, manager)).rejects.toThrow('AWSSecret must have versionId field')
})
