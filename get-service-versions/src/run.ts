import * as core from '@actions/core'
import * as git from './git.js'
import { listApplicationFiles, readApplication, ApplicationVersion } from './application.js'

type Inputs = {
  overlay: string
  namespace: string
  sourceRepository: string
  destinationRepository: string
  destinationRepositoryToken: string
  successIfNotFound: boolean
}

type Outputs = ApplicationVersion[]

export const run = async (inputs: Inputs): Promise<void> => {
  const result = await getServiceVersions(inputs)

  if (result) {
    core.setOutput('application-versions', JSON.stringify(result))
  }
}

export const getServiceVersions = async (inputs: Inputs): Promise<Outputs> => {
  core.info(`Checking out the namespace branch`)
  let namespaceDirectory: string

  try {
    namespaceDirectory = await checkoutNamespaceBranch(inputs)
  } catch (error) {
    if (inputs.successIfNotFound) {
      core.warning(`Namespace branch not found, returning empty list`)
      return []
    }

    throw error
  }
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
