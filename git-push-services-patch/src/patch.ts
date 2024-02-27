import * as core from '@actions/core'
import { promises as fs } from 'fs'
import * as io from '@actions/io'
import * as path from 'path'

type Inputs = {
  workspace: string
  patch: string
  services: Set<string>
  excludeServices: Set<string>
}

export const addToServices = async (inputs: Inputs): Promise<void> => {
  const services = (await readdirOrEmpty(`${inputs.workspace}/services`))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
  core.info(`found ${services.length} service(s)`)

  for (const service of services) {
    if (shouldSkipService(service, inputs.services, inputs.excludeServices)) {
      continue
    }

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
    if (shouldSkipService(service, inputs.services, inputs.excludeServices)) {
      continue
    }

    const patchPath = `${inputs.workspace}/services/${service}/${patchBasename}`
    core.info(`removing ${patchPath}`)
    await io.rmRF(patchPath)
  }
}

const shouldSkipService = (service: string, services: Set<string>, excludeServices: Set<string>) => {
  if (services.size > 0 && !services.has(service)) {
    core.info(`skipping ${service} because it is not specified`)
    return true
  }

  if (excludeServices.has(service)) {
    core.info(`excluded service ${service}`)
    return true
  }

  return false
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
