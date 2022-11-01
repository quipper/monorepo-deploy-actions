import * as core from '@actions/core'
import { promises as fs } from 'fs'
import * as io from '@actions/io'
import * as path from 'path'

type Inputs = {
  workspace: string
  patch: string
}

export const addToServices = async (inputs: Inputs) => {
  const services = (await readdirOrEmpty(`${inputs.workspace}/services`))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
  core.info(`found ${services.length} service(s)`)

  for (const service of services) {
    const serviceDirectory = `${inputs.workspace}/services/${service}`
    core.info(`copying the patch into ${serviceDirectory}`)
    await io.cp(inputs.patch, serviceDirectory, { force: true })
  }
}

export const deleteFromServices = async (inputs: Inputs) => {
  const patchBasename = path.basename(inputs.patch)

  const services = (await readdirOrEmpty(`${inputs.workspace}/services`))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
  core.info(`found ${services.length} service(s)`)

  for (const service of services) {
    const patchPath = `${inputs.workspace}/services/${service}/${patchBasename}`
    core.info(`removing ${patchPath}`)
    await io.rmRF(patchPath)
  }
}

const readdirOrEmpty = async (dir: string) => {
  try {
    return await fs.readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const e = error as { code: string }
      if (e.code === 'ENOENT') {
        return []
      }
    }
    throw error
  }
}
