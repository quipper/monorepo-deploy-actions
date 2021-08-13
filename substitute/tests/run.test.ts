import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import { run } from '../src/run'

test('action runs successfully', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'substitute-action-'))

  await fs.mkdir(`${workspace}/fixtures`)
  await fs.mkdir(`${workspace}/fixtures/a`)
  await fs.mkdir(`${workspace}/fixtures/b`)
  await fs.copyFile(`${__dirname}/fixtures/a/generated.yaml`, `${workspace}/fixtures/a/generated.yaml`)
  await fs.copyFile(`${__dirname}/fixtures/b/generated.yaml`, `${workspace}/fixtures/b/generated.yaml`)

  await run({
    manifests: [`${workspace}/fixtures/a/generated.yaml`, `${workspace}/fixtures/b/generated.yaml`],
    pathPatterns: [`${workspace}/fixtures/:service_name/**`],
    variables: new Map([
      ['DOCKER_IMAGE', '123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/deploy-actions/${service_name}:latest'],
      ['NAMESPACE', 'develop'],
    ]),
  })

  expect(await readContent(`${workspace}/fixtures/a/generated.yaml`)).toBe(`\
# fixture
name: a
namespace: develop
image: 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/deploy-actions/a:latest
`)

  expect(await readContent(`${workspace}/fixtures/b/generated.yaml`)).toBe(`\
# fixture
name: b
namespace: develop
image: 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/deploy-actions/b:latest
`)
})

const readContent = async (f: string): Promise<string> => (await fs.readFile(f)).toString()
