import * as core from '@actions/core'
import * as github from '@actions/github'
import { GitHub } from '@actions/github/lib/utils'

type Octokit = InstanceType<typeof GitHub>

type DeleteNamespaceBranchesOptions = {
  overlay: string
  namespacePrefix: string
  sourceRepositoryName: string
  destinationRepository: string
  destinationRepositoryToken: string
  deployedPullRequestNumbers: number[]
  dryRun: boolean
}

export const deleteNamespaceBranches = async (opts: DeleteNamespaceBranchesOptions): Promise<void> => {
  const octokit = github.getOctokit(opts.destinationRepositoryToken)
  const branches = await findBranches(octokit, opts)
  const branchesToDelete = branches.filter((branch) => shouldDeleteNamespace(branch, opts))
  core.info(`Deleting branches:\n${branchesToDelete.map((b) => b.branchName).join('\n')}`)
  if (opts.dryRun) {
    core.info(`(dry-run)`)
    return
  }

  for (const branch of branchesToDelete) {
    core.info(`Deleting branch ${branch.branchName}`)
    const [owner, repo] = opts.destinationRepository.split('/')
    await octokit.rest.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branch.branchName}`,
    })
  }
}

const shouldDeleteNamespace = (branch: NamespaceBranch, opts: DeleteNamespaceBranchesOptions) => {
  if (opts.deployedPullRequestNumbers.includes(branch.pullRequestNumber)) {
    core.info(`Skip deletion of namespace ${branch.namespace}, because it is still deployed`)
    return false
  }
  return true
}

type NamespaceBranch = {
  branchName: string
  namespace: string
  pullRequestNumber: number
}

const findBranches = async (octokit: Octokit, opts: DeleteNamespaceBranchesOptions) => {
  const [owner, repo] = opts.destinationRepository.split('/')
  const refPrefix = `heads/ns/${opts.sourceRepositoryName}/${opts.overlay}/`
  core.info(`Finding refs with prefix ${refPrefix}`)
  const refs = await octokit.paginate(octokit.rest.git.listMatchingRefs, {
    owner,
    repo,
    ref: refPrefix,
  })

  const branches: NamespaceBranch[] = []
  for (const ref of refs) {
    const namespace = ref.ref.replace(/^.+\//, '')
    const pullRequestNumber = extractPullRequestNumber(namespace, opts.namespacePrefix)
    if (pullRequestNumber === undefined) {
      continue
    }
    const branchName = ref.ref.replace(/^refs\/heads\//, '')
    core.info(`Found namespace branch: ${branchName}`)
    branches.push({
      branchName,
      namespace,
      pullRequestNumber,
    })
  }
  return branches
}

const extractPullRequestNumber = (namespace: string, prefix: string): number | undefined => {
  if (!namespace.startsWith(prefix)) {
    return
  }
  const withoutPrefix = namespace.substring(prefix.length)
  const n = Number.parseInt(withoutPrefix)
  if (Number.isSafeInteger(n)) {
    return n
  }
}
