import { promises as fs } from 'fs'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as match from './match'

interface Inputs {
  files: string
  pathVariablesPattern?: string
  variables: Map<string, string>
}

export const parseVariables = (variables: string[]): Map<string, string> => {
  const m = new Map<string, string>()
  for (const s of variables) {
    const k = s.substring(0, s.indexOf('='))
    const v = s.substring(s.indexOf('=') + 1)
    m.set(k, v)
  }
  return m
}

export const run = async (inputs: Inputs): Promise<void> => {
  let pathVariablesPattern
  if (inputs.pathVariablesPattern) {
    pathVariablesPattern = new match.PathVariablesPattern(inputs.pathVariablesPattern)
  }

  const files = await glob.create(inputs.files, { matchDirectories: false })
  for await (const f of files.globGenerator()) {
    core.info(`reading ${f}`)
    const inputManifest = (await fs.readFile(f)).toString()
    let outputManifest = replace(inputManifest, inputs.variables)

    if (pathVariablesPattern) {
      const pathVariables = pathVariablesPattern.match(f)
      outputManifest = replace(outputManifest, pathVariables)
    }

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
