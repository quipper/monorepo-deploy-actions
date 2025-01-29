import * as core from '@actions/core'
import * as git from './git.js'
import { retryExponential } from './retry.js'
import { listApplicationFiles, readApplication, ApplicationVersion } from './application.js'

type Inputs = {
  overlay: string
  namespace: string
  sourceRepository: string
  destinationRepository: string
  destinationRepositoryToken: string
}

type Outputs = ApplicationVersion[]

export const run = async (inputs: Inputs): Promise<void> => {
  const result = await retryExponential(() => getServiceVersions(inputs), {
    maxAttempts: 50,
    waitMs: 10000,
  })

  if (result) {
    core.setOutput('application-versions', JSON.stringify(result))
  }
}

const getServiceVersions = async (inputs: Inputs): Promise<Outputs | Error> => {
  core.info(`Checking out the namespace branch`)
  const namespaceDirectory = await checkoutNamespaceBranch(inputs)
  core.debug(`Namespace directory: ${namespaceDirectory}`)

  const applicationFiles = await listApplicationFiles(namespaceDirectory)
  const serviceVersionsPromise = applicationFiles.map(async (file) => {
    core.debug(`Reading application file: ${file}`)
    const application = await readApplication(file)
    if (application) {
      core.info(
        `Service: ${application.service}, Action: ${application.action}, HeadRef: ${application.headRef}, HeadSha: ${application.headSha}`,
      )
      return application
    }

    return null
  })

  // return only non-null values
  const serviceVersions = (await Promise.all(serviceVersionsPromise)).filter(
    (serviceVersion): serviceVersion is ApplicationVersion => serviceVersion !== null,
  )

  return serviceVersions
}

const checkoutNamespaceBranch = async (inputs: Inputs) => {
  const [, sourceRepositoryName] = inputs.sourceRepository.split('/')
  return await git.checkout({
    repository: inputs.destinationRepository,
    branch: `ns/${sourceRepositoryName}/${inputs.overlay}/${inputs.namespace}`,
    token: inputs.destinationRepositoryToken,
  })
}
