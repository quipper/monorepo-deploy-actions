import assert from 'node:assert'
import fs from 'node:fs/promises'
import * as yaml from 'js-yaml'

export type PartialApplication = {
  metadata: {
    annotations: {
      'github.action': string
      'github.head-ref': string | undefined
      'github.head-sha': string | undefined
      'built-from-prebuilt-branch': string | undefined
    }
  }
  spec: {
    source: {
      path: string
    }
  }
}

function assertIsPartialApplication(o: unknown): asserts o is PartialApplication {
  assert(typeof o === 'object', 'must be an object')
  assert(o !== null, 'must not be null')
  assert('metadata' in o, 'must have metadata property')
  assert(typeof o.metadata === 'object', 'metadata must be an object')
  assert(o.metadata !== null, 'metadata must not be null')
  assert('annotations' in o.metadata, 'metadata must have annotations property')
  assert(typeof o.metadata.annotations === 'object', 'annotations must be an object')
  assert(o.metadata.annotations !== null, 'annotations must not be null')
  assert('github.action' in o.metadata.annotations, 'annotations must have github.action property')
  assert(typeof o.metadata.annotations['github.action'] === 'string', 'github.action must be a string')
  if ('github.head-ref' in o.metadata.annotations) {
    assert(typeof o.metadata.annotations['github.head-ref'] === 'string', 'github.head-ref must be a string')
  }
  if ('github.head-sha' in o.metadata.annotations) {
    assert(typeof o.metadata.annotations['github.head-sha'] === 'string', 'github.head-sha must be a string')
  }
  assert('spec' in o, 'must have spec property')
  assert(typeof o.spec === 'object', 'spec must be an object')
  assert(o.spec !== null, 'spec must not be null')
  assert('source' in o.spec, 'spec must have source property')
  assert(typeof o.spec.source === 'object', 'source must be an object')
  assert(o.spec.source !== null, 'source must not be null')
  assert('path' in o.spec.source, 'source must have path property')
  assert(typeof o.spec.source.path === 'string', 'path must be a string')
}

export const parseApplicationManifest = async (filename: string): Promise<PartialApplication | Error> => {
  let application: unknown
  try {
    application = yaml.load(await fs.readFile(filename, 'utf-8'))
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      return error
    }
    throw error
  }
  try {
    assertIsPartialApplication(application)
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      return error
    }
    throw error
  }
  return application
}
