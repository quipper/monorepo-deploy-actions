import * as core from '@actions/core'
import * as io from '@actions/io'
import { promises as fs } from 'fs'
import * as path from 'path'

type Inputs = {
  directory: string
  retain: string[]
  namespacePrefix: string
}

export const deletePullRequests = async (r: Inputs): Promise<string[]> => {
  core.info(`finding application manifest(s) in ${r.directory}`)

  const deletedPullRequestNumbers: string[] = []
  const entries = await fs.readdir(r.directory, { withFileTypes: true })
  for (const e of entries) {
    if (!e.isFile()) {
      continue
    }
    if (!e.name.startsWith(r.namespacePrefix) || !e.name.endsWith('.yaml')) {
      core.info(`skip ${e.name}`)
      continue
    }

    const pullRequestNumber = e.name.substring(r.namespacePrefix.length, e.name.length - '.yaml'.length)
    if (r.retain.some((n) => n === pullRequestNumber)) {
      core.info(`retain application ${e.name}`)
      continue
    }

    core.info(`delete ${e.name}`)
    await io.rmRF(path.join(r.directory, e.name))
    deletedPullRequestNumbers.push(pullRequestNumber)
  }
  return deletedPullRequestNumbers
}
