import * as os from 'os'
import * as path from 'path'
import { promises as fs } from 'fs'
import { writeNamespaceManifest } from '../src/namespace'

const readContent = async (filename: string) => (await fs.readFile(filename)).toString()

describe('writeNamespaceManifest', () => {
  it('should copy the manifests', async () => {
    const namespaceDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'bootstrap-pull-request-'))

    await writeNamespaceManifest({
      namespaceManifest: `${__dirname}/fixtures/namespace.yaml`,
      namespaceDirectory,
      substituteVariables: new Map<string, string>([['NAMESPACE', 'pr-123']]),
    })

    expect(await readContent(`${namespaceDirectory}/applications/namespace.yaml`)).toBe(`\
apiVersion: v1
kind: Namespace
metadata:
  name: pr-123
`)
  })
})
