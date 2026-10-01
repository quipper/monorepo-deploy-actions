import assert from 'node:assert'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import { it, mock } from 'node:test'
import { run } from '../src/run.ts'

it('replaces the placeholders of secrets', async () => {
  const manager = { getCurrentVersionId: mock.fn(async () => 'c7ea50c5-b2be-4970-bf90-2237bef3b4cf') }

  const tempdir = await fs.mkdtemp(`${os.tmpdir()}/resolve-aws-secret-version-action-`)
  await fs.copyFile(
    `${import.meta.dirname}/fixtures/input-with-awssecret-placeholder.yaml`,
    `${tempdir}/input-with-awssecret-placeholder.yaml`,
  )
  await fs.copyFile(
    `${import.meta.dirname}/fixtures/input-with-externalsecret-placeholder.yaml`,
    `${tempdir}/input-with-externalsecret-placeholder.yaml`,
  )

  await run(
    {
      manifests: `${tempdir}/**/*.yaml`,
    },
    manager,
  )

  assert.strictEqual(
    await fs.readFile(`${tempdir}/input-with-awssecret-placeholder.yaml`, 'utf-8'),
    await fs.readFile(`${import.meta.dirname}/fixtures/expected-with-awssecret-placeholder.yaml`, 'utf-8'),
  )
  assert.strictEqual(
    await fs.readFile(`${tempdir}/input-with-externalsecret-placeholder.yaml`, 'utf-8'),
    await fs.readFile(`${import.meta.dirname}/fixtures/expected-with-externalsecret-placeholder.yaml`, 'utf-8'),
  )
})
