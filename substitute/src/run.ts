import { promises as fs } from 'fs'
import * as core from '@actions/core'
import * as glob from '@actions/glob'

type Inputs = {
  files: string
  variables: Map<string, string>
}

export const parseVariables = (variables: string[]): Map<string, string> => {
  const map = new Map<string, string>()
  for (const s of variables) {
    const equalIndex = s.indexOf('=')
    if (equalIndex === -1) {
      throw new Error(`variable must be in the form of key=value: ${s}`)
    }
    const k = s.substring(0, equalIndex)
    const v = s.substring(equalIndex + 1)
    map.set(k, v)
  }
  return map
}

export const run = async (inputs: Inputs): Promise<void> => {
  const files = await glob.create(inputs.files, { matchDirectories: false })
  for await (const f of files.globGenerator()) {
    core.info(`reading ${f}`)
    const inputManifest = (await fs.readFile(f)).toString()
    const outputManifest = replace(inputManifest, inputs.variables)
    core.info(`writing to ${f}`)
    await fs.writeFile(f, outputManifest, { encoding: 'utf-8' })
  }
}

const replace = (s: string, variables: Map<string, string>): string => {
  let result = s
  for (const [k, v] of variables) {
    const placeholder = '${' + k + '}'
    core.info(`replace ${placeholder} => ${v}`)
    result = replaceAll(result, placeholder, v)
  }
  return result
}

const replaceAll = (s: string, oldString: string, newString: string): string => s.split(oldString).join(newString)
