import * as core from '@actions/core'
import * as github from '@actions/github'
import { deleteNamespaceApplicationsWithRetry } from './namespace'
import { notifyDeletion } from './notify'

type Inputs = {
  overlay: string
  namespacePrefix: string
  sourceRepository: string
  sourceRepositoryToken: string
  destinationRepository: string
  destinationBranch: string
  destinationRepositoryToken: string
  excludeLabel: string | undefined
  excludeUpdatedWithinMinutes: number
  removeLabelOnDeletion: string | undefined
  commentOnDeletion: string | undefined
  dryRun: boolean
}

export const run = async (inputs: Inputs): Promise<void> => {
  const [, sourceRepositoryName] = inputs.sourceRepository.split('/')
  const excludePullRequestNumbers = await listExcludedPullRequestNumbers(inputs)

  const deletedPullRequestNumbers = await deleteNamespaceApplicationsWithRetry({
    overlay: inputs.overlay,
    namespacePrefix: inputs.namespacePrefix,
    excludePullRequestNumbers,
    excludeUpdatedWithinMinutes: inputs.excludeUpdatedWithinMinutes,
    sourceRepositoryName,
    destinationRepository: inputs.destinationRepository,
    destinationBranch: inputs.destinationBranch,
    destinationRepositoryToken: inputs.destinationRepositoryToken,
    commitMessage,
    dryRun: inputs.dryRun,
  })

  if (!inputs.dryRun) {
    await notifyDeletion(deletedPullRequestNumbers, inputs)
  }
}

const listExcludedPullRequestNumbers = async (inputs: Inputs) => {
  if (!inputs.excludeLabel) {
    return []
  }

  core.info(`Getting pull requests with label ${inputs.excludeLabel} in ${inputs.sourceRepository}`)
  const octokit = github.getOctokit(inputs.sourceRepositoryToken)
  const [owner, repo] = inputs.sourceRepository.split('/')
  const pulls = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner,
    repo,
    state: 'open',
    labels: inputs.excludeLabel,
    per_page: 100,
  })
  return pulls.map((pull) => pull.number)
}

const commitMessage = `Delete pull request namespaces
${github.context.action}
${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`
