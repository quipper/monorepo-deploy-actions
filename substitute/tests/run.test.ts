import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import { run } from '../src/run'

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

test('path variable is available', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'substitute-action-'))

  await fs.mkdir(`${workspace}/fixtures`)
  await fs.mkdir(`${workspace}/fixtures/a`)
  await fs.mkdir(`${workspace}/fixtures/b`)
  await fs.copyFile(`${__dirname}/fixtures/a/generated.yaml`, `${workspace}/fixtures/a/generated.yaml`)
  await fs.copyFile(`${__dirname}/fixtures/b/generated.yaml`, `${workspace}/fixtures/b/generated.yaml`)

  await run({
    files: `${workspace}/fixtures/**`,
    pathVariablesPattern: `${workspace}/fixtures/\${service_name}/**`,
    variables: new Map([
      ['DOCKER_IMAGE', '123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/${service_name}:latest'],
      ['NAMESPACE', 'develop'],
    ]),
  })

  expect(await readContent(`${workspace}/fixtures/a/generated.yaml`)).toBe(`\
# fixture
name: a
namespace: develop
image: 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/a:latest
`)

  expect(await readContent(`${workspace}/fixtures/b/generated.yaml`)).toBe(`\
# fixture
name: b
namespace: develop
image: 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/b:latest
`)
})

const readContent = async (f: string): Promise<string> => (await fs.readFile(f)).toString()
