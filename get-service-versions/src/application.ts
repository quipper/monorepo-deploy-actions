import assert from 'assert'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import { promises as fs } from 'fs'
import * as yaml from 'js-yaml'

export type ApplicationVersion = {
  service: string
  action: string
  headRef: string
  headSha: string
}

type PartialApplication = {
  metadata: {
    name: string
    annotations: {
      'github.action': string
      'github.head-ref': string | undefined
      'github.head-sha': string | undefined
    }
  }
}

function assertIsApplication(o: unknown): asserts o is PartialApplication {
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
  if ('github.head-sha' in o.metadata.annotations) {
    assert(typeof o.metadata.annotations['github.head-sha'] === 'string', 'github.head-sha must be a string')
  }
}

// expect applicationManifestPath to be applications/<namespace>--<service>.yaml
const extractServiceNameFromApplicationName = (applicationName: string): string => {
  return applicationName.split('--')[1]
}

// parse ArgoCD's Application manifest, and parse annotations
export const readApplication = async (applicationManifestPath: string): Promise<ApplicationVersion | null> => {
  let application
  try {
    const content = await fs.readFile(applicationManifestPath, 'utf-8')
    application = yaml.load(content)
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      core.warning(`Invalid application manifest ${applicationManifestPath}: ${error.toString()}`)
      return null
    }
    throw error
  }

  try {
    assertIsApplication(application)
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      core.info(`Invalid application manifest ${applicationManifestPath}: ${error.message}`)
      return null
    }
    throw error
  }

  return {
    service: extractServiceNameFromApplicationName(application.metadata.name),
    action: application.metadata.annotations['github.action'],
    headRef: application.metadata.annotations['github.head-ref'] ?? 'main',
    headSha: application.metadata.annotations['github.head-sha'] ?? 'HEAD',
  }
}

export const listApplicationFiles = async (namespaceDirectory: string): Promise<string[]> => {
  const globber = await glob.create(`${namespaceDirectory}/applications/*--*.yaml`, { matchDirectories: false })
  return globber.glob()
}
