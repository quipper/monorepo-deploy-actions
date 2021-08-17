import * as core from '@actions/core'
import * as github from '@actions/github'
import { computeRefsToDelete } from './delete'

interface Inputs {
  retainPullRequestNumbers: string[]
  namespacePrefix: string
  overlay: string
  destinationRepository: string
  token: string
  dryRun: boolean
}

export const run = async (inputs: Inputs): Promise<void> => {
  const octokit = github.getOctokit(inputs.token)

  const [owner, repo] = inputs.destinationRepository.split('/')
  const project = github.context.repo.repo
  const refPrefix = `heads/ns/${project}/${inputs.overlay}/`

  core.info(`list refs with prefix ${refPrefix}`)
  const listMatchingRefs = await octokit.rest.git.listMatchingRefs({
    owner,
    repo,
    ref: refPrefix,
  })
  const refNames = listMatchingRefs.data.map((ref) => ref.ref)

  const refsToDelete = computeRefsToDelete(refNames, inputs.retainPullRequestNumbers, inputs.namespacePrefix)
  core.info(`found ${refNames.length} refs and delete ${refsToDelete.length} refs`)

  for (const ref of refsToDelete) {
    if (inputs.dryRun) {
      core.info(`(dry-run) delete ${ref}`)
      continue
    }

    core.info(`delete ${ref}`)
    await octokit.rest.git.deleteRef({
      owner,
      repo,
      ref: ref.replace(/^refs\//, ''),
    })
  }
}
