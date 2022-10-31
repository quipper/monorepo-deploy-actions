import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import { addToServices, deleteFromServices } from '../src/patch'

const patch = path.join(__dirname, 'fixtures/kustomization.yaml')

describe('addToServices', () => {
  test('if there are several services', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-patch-'))
    await fs.mkdir(path.join(workspace, `services`))
    await fs.mkdir(path.join(workspace, `services/a`))
    await fs.mkdir(path.join(workspace, `services/b`))

    await expect(addToServices({ workspace, patch })).resolves.toBeUndefined()

    await fs.access(path.join(workspace, `services/a/kustomization.yaml`))
    await fs.access(path.join(workspace, `services/b/kustomization.yaml`))
  })

  test('if empty directory', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-patch-'))
    await expect(addToServices({ workspace, patch })).resolves.toBeUndefined()
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

    await expect(deleteFromServices({ workspace, patch })).resolves.toBeUndefined()

    await expect(fs.access(path.join(workspace, `services/a/kustomization.yaml`))).rejects.toThrow()
    await expect(fs.access(path.join(workspace, `services/b/kustomization.yaml`))).rejects.toThrow()
  })

  test('if empty directory', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-push-services-patch-'))
    await expect(deleteFromServices({ workspace, patch })).resolves.toBeUndefined()
  })
})
