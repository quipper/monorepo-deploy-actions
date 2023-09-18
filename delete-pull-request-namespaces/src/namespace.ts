import * as core from '@actions/core'
import * as git from './git'
import * as io from '@actions/io'
import * as path from 'path'
import { promises as fs } from 'fs'
import { retryExponential } from './retry'

type DeleteNamespaceApplicationsOptions = {
  overlay: string
  namespacePrefix: string
  sourceRepositoryName: string
  destinationRepository: string
  destinationBranch: string
  destinationRepositoryToken: string
  excludePullRequestNumbers: number[]
  excludeUpdatedWithinMinutes: number
  commitMessage: string
  dryRun: boolean
}

export const deleteNamespaceApplicationsWithRetry = async (opts: DeleteNamespaceApplicationsOptions) =>
  await retryExponential(deleteNamespaceApplications(opts), {
    maxAttempts: 5,
    waitMs: 10000,
  })

const deleteNamespaceApplications = async (opts: DeleteNamespaceApplicationsOptions) => {
  const cwd = await git.checkout({
    repository: opts.destinationRepository,
    branch: opts.destinationBranch,
    token: opts.destinationRepositoryToken,
  })

  core.info(`Prefetching namespace branches`)
  await git.fetch(cwd, `ns/${opts.sourceRepositoryName}/${opts.overlay}/*`)

  const applications = await findNamespaceApplication(cwd, opts)
  const deletedPullRequestNumbers = []
  for (const application of applications) {
    if (opts.excludePullRequestNumbers.includes(application.pullRequestNumber)) {
      core.info(`Skip deletion of namespace ${application.namespace}, because it has the label`)
      continue
    }

    // Do not delete an application updated recently.
    // Argo CD would be stuck on deletion if PreSync hook is in progress.
    const lastUpdatedAgoMinutes = await getLastUpdatedAgoMinutes(cwd, `origin/${application.namespaceBranch}`)
    core.info(`Namespace ${application.namespace} was updated ${lastUpdatedAgoMinutes} minutes ago`)
    if (lastUpdatedAgoMinutes < opts.excludeUpdatedWithinMinutes) {
      core.info(`Skip deletion of namespace ${application.namespace}`)
      continue
    }

    core.info(`Deleting namespace ${application.namespace} of ${application.filepath}`)
    await io.rmRF(application.filepath)
    deletedPullRequestNumbers.push(application.pullRequestNumber)
  }

  if (!opts.dryRun && deletedPullRequestNumbers.length > 0) {
    const commitMessage = `${opts.commitMessage}\n${deletedPullRequestNumbers.join(', ')}`
    await git.commit(cwd, commitMessage)
    const pushCode = await git.pushByFastForward(cwd)
    if (pushCode > 0) {
      return new Error(`git-push returned code ${pushCode}`) // retry
    }
  }
  return deletedPullRequestNumbers
}

type NamespaceApplication = {
  filepath: string
  namespace: string
  namespaceBranch: string
  pullRequestNumber: number
}

const findNamespaceApplication = async (cwd: string, opts: DeleteNamespaceApplicationsOptions) => {
  const baseDirectory = path.join(cwd, opts.sourceRepositoryName, opts.overlay)
  const entries = await fs.readdir(baseDirectory, { withFileTypes: true })
  const filenames = entries.filter((e) => e.isFile()).map((e) => e.name)

  core.info(`Finding applications in ${baseDirectory}`)
  const applications: NamespaceApplication[] = []
  for (const filename of filenames) {
    const pullRequestNumber = extractPullRequestNumber(filename, opts.namespacePrefix)
    if (pullRequestNumber === undefined) {
      continue
    }
    applications.push({
      filepath: path.join(baseDirectory, filename),
      namespace: `${opts.namespacePrefix}${pullRequestNumber}`,
      namespaceBranch: `ns/${opts.sourceRepositoryName}/${opts.overlay}/${opts.namespacePrefix}${pullRequestNumber}`,
      pullRequestNumber,
    })
  }
  return applications
}

const extractPullRequestNumber = (filename: string, prefix: string, suffix = '.yaml'): number | undefined => {
  if (!filename.startsWith(prefix) || !filename.endsWith(suffix)) {
    return
  }
  const withoutPrefix = filename.substring(prefix.length)
  const withoutSuffix = withoutPrefix.substring(0, suffix.length)
  const n = Number.parseInt(withoutSuffix)
  if (Number.isSafeInteger(n)) {
    return n
  }
}

const getLastUpdatedAgoMinutes = async (cwd: string, branch: string): Promise<number> => {
  const lastCommitDate = await git.getLastCommitDate(cwd, branch)
  return Math.floor((Date.now() - lastCommitDate.getTime()) / (60 * 1000))
}
