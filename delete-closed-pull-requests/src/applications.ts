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
  openPullRequestNumbers: number[]
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

  const applications = await findApplications(cwd, opts)
  const deletedApplications = []
  const deployedApplications = []
  for (const application of applications) {
    if (await shouldDeleteNamespace(application, cwd, opts)) {
      core.info(`Removing ${application.filepath}`)
      await io.rmRF(application.filepath)
      deletedApplications.push(application)
    } else {
      deployedApplications.push(application)
    }
  }
  const result = {
    deployedPullRequestNumbers: deployedApplications.map((app) => app.pullRequestNumber),
  }
  if (deletedApplications.length === 0) {
    core.info(`Nothing to delete`)
    return result
  }
  const deletedNamespaces = deletedApplications.map((app) => app.namespace).join('\n')
  const commitMessage = `${opts.commitMessage}\nDeleted:\n${deletedNamespaces}`
  await git.commit(cwd, commitMessage)

  if (opts.dryRun) {
    core.info(`(dry-run) git-push`)
    return result
  }
  const pushCode = await git.pushByFastForward(cwd)
  if (pushCode > 0) {
    // Retry from checkout if fast-forward was failed
    return new Error(`git-push returned code ${pushCode}`)
  }
  return result
}

const shouldDeleteNamespace = async (
  application: NamespaceApplication,
  cwd: string,
  opts: DeleteNamespaceApplicationsOptions,
) => {
  if (opts.openPullRequestNumbers.includes(application.pullRequestNumber)) {
    core.info(`Skip deletion of namespace ${application.namespace}, because it is open`)
    return false
  }

  const lastCommitDate = await git.getLastCommitDate(cwd, application.namespaceBranch)
  if (lastCommitDate === undefined) {
    core.info(`Namespace branch ${application.namespaceBranch} does not exist`)
    return true
  }

  // Do not delete an application updated recently.
  // Argo CD would be stuck on deletion if PreSync hook is in progress.
  // If excludeUpdatedWithinMinutes is zero, exclude nothing.
  const agoMinutes = Math.floor((Date.now() - lastCommitDate.getTime()) / (60 * 1000))
  core.info(`Branch ${application.namespaceBranch} was updated ${agoMinutes} minutes ago`)
  if (agoMinutes < opts.excludeUpdatedWithinMinutes) {
    core.info(`Skip deletion of namespace ${application.namespace}, because the namespace branch was updated recently`)
    return false
  }
  return true
}

type NamespaceApplication = {
  filepath: string
  namespace: string
  namespaceBranch: string
  pullRequestNumber: number
}

const findApplications = async (cwd: string, opts: DeleteNamespaceApplicationsOptions) => {
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
    core.info(`Found namespace application: ${filename}`)
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
