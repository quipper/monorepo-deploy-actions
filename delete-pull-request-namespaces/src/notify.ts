import * as core from '@actions/core'
import * as github from '@actions/github'
import { RequestError } from '@octokit/request-error'

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
    // check type of error
    if (error == null || typeof error !== 'object' || !('name' in error)) {
      throw error
    }
    const maybeGhError = error as RequestError
    // if error is RequestError and status is 404, ignore it
    if (maybeGhError.name === 'HttpError' && maybeGhError.status === 404) {
      core.info(`Ignore error: ${maybeGhError.status} ${maybeGhError.message}`)
      return
    }
    throw error
  }
}
