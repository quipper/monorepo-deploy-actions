import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it, test } from 'vitest'
import { parseVariables, run } from '../src/run.js'

test('variables are replaced', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'substitute-action-'))

  await fs.mkdir(`${workspace}/fixtures`)
  await fs.mkdir(`${workspace}/fixtures/a`)
  await fs.copyFile(`${__dirname}/fixtures/a/generated.yaml`, `${workspace}/fixtures/a/generated.yaml`)

  await run({
    files: `${workspace}/fixtures/**`,
    variables: new Map([
      ['DOCKER_IMAGE', '123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/example:latest'],
      ['NAMESPACE', 'develop'],
    ]),
  })

  expect(await readContent(`${workspace}/fixtures/a/generated.yaml`)).toBe(`\
# fixture
name: a
namespace: develop
image: 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/example:latest
`)
})

const readContent = async (f: string): Promise<string> => (await fs.readFile(f)).toString()

describe('parseVariables', () => {
  it('parses variables', () => {
    expect(parseVariables(['DOCKER_IMAGE=123', 'NAMESPACE=develop', 'VERSION='])).toStrictEqual(
      new Map([
        ['DOCKER_IMAGE', '123'],
        ['NAMESPACE', 'develop'],
        ['VERSION', ''],
      ]),
    )
  })

  it('throws an error if variable is not in the form of key=value', () => {
    expect(() => parseVariables(['DOCKER_IMAGE=123', 'NAMESPACE'])).toThrow(
      'variable must be in the form of key=value: NAMESPACE',
    )
  })
})
