import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  const outputs = await run({
    rules: core.getInput('rules', { required: true }),
    service: core.getInput('service'),
    token: core.getInput('token'),
  })
  core.info('Setting outputs:')
  for (const [k, v] of Object.entries(outputs.outputs)) {
    core.info(`${k}=${v}`)
    core.setOutput(k, v)
  }
  if (outputs.githubDeploymentURL) {
    core.info(`github-deployment-url=${outputs.githubDeploymentURL}`)
    core.setOutput('github-deployment-url', outputs.githubDeploymentURL)
  }
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
