import * as core from '@actions/core'
import * as github from '@actions/github'
import { deleteNamespaceApplicationsWithRetry } from './applications'
import { deleteNamespaceBranches } from './branches'

type Inputs = {
  overlay: string
  namespacePrefix: string
  sourceRepository: string
  sourceRepositoryToken: string
  destinationRepository: string
  destinationBranch: string
  destinationRepositoryToken: string
  excludeUpdatedWithinMinutes: number
  dryRun: boolean
}

export const run = async (inputs: Inputs): Promise<void> => {
  const [, sourceRepositoryName] = inputs.sourceRepository.split('/')
  const openPullRequestNumbers = await listOpenPullRequestNumbers(inputs)

  core.info(`Deleting namespace applications`)
  const { deployedPullRequestNumbers } = await deleteNamespaceApplicationsWithRetry({
    overlay: inputs.overlay,
    namespacePrefix: inputs.namespacePrefix,
    openPullRequestNumbers,
    sourceRepositoryName,
    destinationRepository: inputs.destinationRepository,
    destinationBranch: inputs.destinationBranch,
    destinationRepositoryToken: inputs.destinationRepositoryToken,
    excludeUpdatedWithinMinutes: inputs.excludeUpdatedWithinMinutes,
    commitMessage,
    dryRun: inputs.dryRun,
  })

  core.info(`Deleting namespace branches`)
  await deleteNamespaceBranches({
    overlay: inputs.overlay,
    namespacePrefix: inputs.namespacePrefix,
    deployedPullRequestNumbers,
    sourceRepositoryName,
    destinationRepository: inputs.destinationRepository,
    destinationRepositoryToken: inputs.destinationRepositoryToken,
    dryRun: inputs.dryRun,
  })
}

const listOpenPullRequestNumbers = async (inputs: Inputs) => {
  core.info(`Getting open pull requests in ${inputs.sourceRepository}`)
  const octokit = github.getOctokit(inputs.sourceRepositoryToken)
  const [owner, repo] = inputs.sourceRepository.split('/')
  const pulls = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner,
    repo,
    state: 'open',
    per_page: 100,
  })
  return pulls.map((pull) => pull.number)
}

const commitMessage = `Delete closed pull request namespaces
${github.context.action}
${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`
