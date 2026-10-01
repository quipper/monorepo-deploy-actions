import assert from 'node:assert'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it, test } from 'node:test'
import { parseVariables, run } from '../src/run.ts'

test('variables are replaced', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'substitute-action-'))

  await fs.mkdir(`${workspace}/fixtures`)
  await fs.mkdir(`${workspace}/fixtures/a`)
  await fs.copyFile(`${import.meta.dirname}/fixtures/a/generated.yaml`, `${workspace}/fixtures/a/generated.yaml`)

  await run({
    files: `${workspace}/fixtures/**`,
    variables: new Map([
      ['DOCKER_IMAGE', '123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/example:latest'],
      ['NAMESPACE', 'develop'],
    ]),
  })

  assert.strictEqual(
    await readContent(`${workspace}/fixtures/a/generated.yaml`),
    `\
# fixture
name: a
namespace: develop
image: 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/example:latest
`,
  )
})

const readContent = async (f: string): Promise<string> => (await fs.readFile(f)).toString()

describe('parseVariables', () => {
  it('parses variables', () => {
    assert.deepStrictEqual(
      parseVariables(['DOCKER_IMAGE=123', 'NAMESPACE=develop', 'VERSION=']),
      new Map([
        ['DOCKER_IMAGE', '123'],
        ['NAMESPACE', 'develop'],
        ['VERSION', ''],
      ]),
    )
  })

  it('throws an error if variable is not in the form of key=value', () => {
    assert.throws(() => parseVariables(['DOCKER_IMAGE=123', 'NAMESPACE']), {
      message: /variable must be in the form of key=value: NAMESPACE/,
    })
  })
})
