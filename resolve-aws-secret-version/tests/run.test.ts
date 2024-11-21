import { promises as fs } from 'fs'
import * as awsSecretsManager from '../src/awsSecretsManager'
import * as os from 'os'
import { run } from '../src/run.js'

jest.mock('../src/awsSecretsManager')
const getCurrentVersionId = awsSecretsManager.getCurrentVersionId as jest.Mock

test('run', async () => {
  getCurrentVersionId.mockResolvedValue('c7ea50c5-b2be-4970-bf90-2237bef3b4cf')

  const tempdir = await fs.mkdtemp(`${os.tmpdir()}/resolve-aws-secret-version-action-`)
  const fixtureFile = `${tempdir}/fixture.yaml`
  await fs.copyFile(`${__dirname}/fixtures/input-with-awssecret-placeholder.yaml`, fixtureFile)

  await run({
    manifests: `${tempdir}/**/*.yaml`,
  })

  const output = (await fs.readFile(fixtureFile)).toString()
  const expected = (await fs.readFile(`${__dirname}/fixtures/expected-with-awssecret-placeholder.yaml`)).toString()
  expect(output).toBe(expected)
})
