import assert from 'node:assert'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, test } from 'node:test'
import { addToServices, deleteFromServices } from '../src/patch.ts'

const patch = path.join(import.meta.dirname, 'fixtures/kustomization.yaml')

describe('addToServices', () => {
  test('if there are several services', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-patch-'))
    await fs.mkdir(path.join(workspace, `services`))
    await fs.mkdir(path.join(workspace, `services/a`))
    await fs.mkdir(path.join(workspace, `services/b`))

    assert.strictEqual(
      await addToServices({ workspace, patch, services: new Set(), excludeServices: new Set() }),
      undefined,
    )

    await fs.access(path.join(workspace, `services/a/kustomization.yaml`))
    await fs.access(path.join(workspace, `services/b/kustomization.yaml`))
  })

  test('exclude a service', async () => {
    const excludeServices = new Set(['a'])
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-patch-'))
    await fs.mkdir(path.join(workspace, `services`))
    await fs.mkdir(path.join(workspace, `services/a`))
    await fs.mkdir(path.join(workspace, `services/b`))

    assert.strictEqual(await addToServices({ workspace, patch, services: new Set(), excludeServices }), undefined)

    await assert.rejects(fs.access(path.join(workspace, `services/a/kustomization.yaml`)))
    await fs.access(path.join(workspace, `services/b/kustomization.yaml`))
  })

  test('specify a service', async () => {
    const services = new Set(['a'])
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-patch-'))
    await fs.mkdir(path.join(workspace, `services`))
    await fs.mkdir(path.join(workspace, `services/a`))
    await fs.mkdir(path.join(workspace, `services/b`))

    assert.strictEqual(await addToServices({ workspace, patch, services, excludeServices: new Set() }), undefined)

    await fs.access(path.join(workspace, `services/a/kustomization.yaml`))
    await assert.rejects(fs.access(path.join(workspace, `services/b/kustomization.yaml`)))
  })

  test('specify and exclude services', async () => {
    const services = new Set(['a', 'b'])
    const excludeServices = new Set(['b', 'c'])
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-patch-'))
    await fs.mkdir(path.join(workspace, `services`))
    await fs.mkdir(path.join(workspace, `services/a`))
    await fs.mkdir(path.join(workspace, `services/b`))
    await fs.mkdir(path.join(workspace, `services/c`))

    assert.strictEqual(await addToServices({ workspace, patch, services, excludeServices }), undefined)

    await fs.access(path.join(workspace, `services/a/kustomization.yaml`))
    await assert.rejects(fs.access(path.join(workspace, `services/b/kustomization.yaml`)))
    await assert.rejects(fs.access(path.join(workspace, `services/c/kustomization.yaml`)))
  })

  test('if empty directory', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-patch-'))
    assert.strictEqual(
      await addToServices({ workspace, patch, services: new Set(), excludeServices: new Set() }),
      undefined,
    )
  })
})

describe('deleteFromServices', () => {
  test('if there are several services', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-patch-'))
    await fs.mkdir(path.join(workspace, `services`))
    await fs.mkdir(path.join(workspace, `services/a`))
    await fs.mkdir(path.join(workspace, `services/b`))
    await fs.writeFile(path.join(workspace, `services/a/kustomization.yaml`), 'dummy')
    await fs.writeFile(path.join(workspace, `services/b/kustomization.yaml`), 'dummy')

    assert.strictEqual(
      await deleteFromServices({ workspace, patch, services: new Set(), excludeServices: new Set() }),
      undefined,
    )

    await assert.rejects(fs.access(path.join(workspace, `services/a/kustomization.yaml`)))
    await assert.rejects(fs.access(path.join(workspace, `services/b/kustomization.yaml`)))
  })

  test('exclude a service', async () => {
    const excludeServices = new Set(['b'])
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-patch-'))
    await fs.mkdir(path.join(workspace, `services`))
    await fs.mkdir(path.join(workspace, `services/a`))
    await fs.mkdir(path.join(workspace, `services/b`))
    await fs.writeFile(path.join(workspace, `services/a/kustomization.yaml`), 'dummy')
    await fs.writeFile(path.join(workspace, `services/b/kustomization.yaml`), 'dummy')

    assert.strictEqual(await deleteFromServices({ workspace, patch, services: new Set(), excludeServices }), undefined)

    await assert.rejects(fs.access(path.join(workspace, `services/a/kustomization.yaml`)))
    await fs.access(path.join(workspace, `services/b/kustomization.yaml`))
  })

  test('if empty directory', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-patch-'))
    assert.strictEqual(
      await deleteFromServices({ workspace, patch, services: new Set(), excludeServices: new Set() }),
      undefined,
    )
  })
})
