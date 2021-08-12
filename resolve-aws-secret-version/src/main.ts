import * as core from '@actions/core'
import { run } from './run'

async function main(): Promise<void> {
  try {
    const inputs = {
      manifestPaths: core.getMultilineInput('manifest', { required: true }),
      inPlace: core.getBooleanInput('in-place', { required: true }),
    }
    const outputs = await run(inputs)
    core.setOutput('path', outputs.manifestPaths.join('\n'))
  } catch (error) {
    core.setFailed(error.message)
  }
}

main()
