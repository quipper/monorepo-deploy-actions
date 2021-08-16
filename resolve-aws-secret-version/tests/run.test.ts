import { promises as fs } from 'fs'
import * as awsSecretsManager from '../src/awsSecretsManager'
import { run } from '../src/run'

jest.mock('../src/awsSecretsManager')
const getCurrentVersionId = awsSecretsManager.getCurrentVersionId as jest.Mock

test('run', async () => {
  getCurrentVersionId.mockResolvedValue('c7ea50c5-b2be-4970-bf90-2237bef3b4cf')

  const inputs = {
    manifests: `${__dirname}/fixtures/input-with-awssecret-placeholder.yaml`,
    writeInPlace: false,
  }
  const outputs = await run(inputs)
  expect(outputs.manifestPaths.length).toBe(1)
  const output = (await fs.readFile(outputs.manifestPaths[0])).toString()
  const expected = (await fs.readFile(`${__dirname}/fixtures/expected-with-awssecret-placeholder.yaml`)).toString()
  expect(output).toBe(expected)
})
