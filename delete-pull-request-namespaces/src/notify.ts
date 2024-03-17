import * as core from '@actions/core'
import * as github from '@actions/github'

type NotifyDeletionOptions = {
  sourceRepository: string
  sourceRepositoryToken: string
  removeLabelOnDeletion: string | undefined
  commentOnDeletion: string | undefined
}

export const notifyDeletion = async (pullRequestNumbers: number[], opts: NotifyDeletionOptions) => {
  const octokit = github.getOctokit(opts.sourceRepositoryToken)
  const [owner, repo] = opts.sourceRepository.split('/')

  if (opts.removeLabelOnDeletion) {
    for (const pullRequestNumber of pullRequestNumbers) {
      core.info(`Removing the label from #${pullRequestNumber}`)
      await ignoreNotFoundError(
        octokit.rest.issues.removeLabel({
          owner,
          repo,
          issue_number: pullRequestNumber,
          name: opts.removeLabelOnDeletion,
        }),
      )
    }
  }

  if (opts.commentOnDeletion) {
    for (const pullRequestNumber of pullRequestNumbers) {
      core.info(`Creating a comment to #${pullRequestNumber}`)
      const { data: comment } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullRequestNumber,
        body: opts.commentOnDeletion,
      })
      core.info(`Created ${comment.html_url}`)
    }
  }
}

const ignoreNotFoundError = async <T>(f: Promise<T>) => {
  try {
    return await f
  } catch (error) {
    if (isRequestError(error) && error.status === 404) {
      core.info(`Ignore error: ${error.status} ${error.message}`)
      return
    }
    throw error
  }
}

type RequestError = Error & { status: number }

const isRequestError = (error: unknown): error is RequestError =>
  error instanceof Error && 'status' in error && typeof error.status === 'number'
