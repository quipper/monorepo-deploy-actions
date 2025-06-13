import { promises as fs } from 'fs'
import * as awsSecretsManager from '../src/awsSecretsManager.js'
import * as os from 'os'
import { run } from '../src/run.js'

jest.mock('../src/awsSecretsManager')
const getCurrentVersionId = awsSecretsManager.getCurrentVersionId as jest.Mock

it('replaces the placeholders of secrets', async () => {
  getCurrentVersionId.mockResolvedValue('c7ea50c5-b2be-4970-bf90-2237bef3b4cf')

  const tempdir = await fs.mkdtemp(`${os.tmpdir()}/resolve-aws-secret-version-action-`)
  await fs.copyFile(
    `${__dirname}/fixtures/input-with-awssecret-placeholder.yaml`,
    `${tempdir}/input-with-awssecret-placeholder.yaml`,
  )
  await fs.copyFile(
    `${__dirname}/fixtures/input-with-externalsecret-placeholder.yaml`,
    `${tempdir}/input-with-externalsecret-placeholder.yaml`,
  )

  await run({
    manifests: `${tempdir}/**/*.yaml`,
  })

  expect(await fs.readFile(`${tempdir}/input-with-awssecret-placeholder.yaml`, 'utf-8')).toBe(
    await fs.readFile(`${__dirname}/fixtures/expected-with-awssecret-placeholder.yaml`, 'utf-8'),
  )
  expect(await fs.readFile(`${tempdir}/input-with-externalsecret-placeholder.yaml`, 'utf-8')).toBe(
    await fs.readFile(`${__dirname}/fixtures/expected-with-externalsecret-placeholder.yaml`, 'utf-8'),
  )
})
