import assert from 'node:assert'
import * as core from '@actions/core'
import type * as github from '@actions/github'
import { assertPullRequestPayload, type Octokit } from './github.js'
import type { GitHubDeployment } from './rule.js'

type Context = Pick<typeof github.context, 'eventName' | 'repo' | 'ref' | 'payload'>

export const createDeployment = async (octokit: Octokit, context: Context, deployment: GitHubDeployment) => {
  core.info(`Finding the old deployments for environment ${deployment.environment}`)
  const oldDeployments = await octokit.rest.repos.listDeployments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    environment: deployment.environment,
  })

  core.info(`Deleting ${oldDeployments.data.length} deployment(s)`)
  for (const deployment of oldDeployments.data) {
    try {
      await octokit.rest.repos.deleteDeployment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        deployment_id: deployment.id,
      })
    } catch (error) {
      if (isRequestError(error)) {
        core.warning(`Could not delete the old deployment ${deployment.url}: ${error.status} ${error.message}`)
        continue
      }
      throw error
    }
    core.info(`Deleted the old deployment ${deployment.url}`)
  }
  core.info(`Deleted ${oldDeployments.data.length} deployment(s)`)

  const ref = getDeploymentRef(context)
  core.info(`Creating a deployment for environment=${deployment.environment}, ref=${ref}`)
  const created = await octokit.rest.repos.createDeployment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref,
    environment: deployment.environment,
    task: deployment.task,
    auto_merge: false,
    required_contexts: [],
    transient_environment: context.eventName === 'pull_request',
  })
  assert.strictEqual(created.status, 201)
  core.info(`Created a deployment ${created.data.url}`)

  // If the deployment is not deployed for a while, it will cause the following error:
  //   This branch had an error being deployed
  //   1 abandoned deployment
  //
  // To avoid this, we set the deployment status to inactive immediately.
  core.info(`Setting the deployment status to inactive`)
  await octokit.rest.repos.createDeploymentStatus({
    owner: context.repo.owner,
    repo: context.repo.repo,
    deployment_id: created.data.id,
    state: 'inactive',
  })
  core.info(`Set the deployment status to inactive`)
  return created.data
}

const getDeploymentRef = (context: Context): string => {
  if (context.eventName === 'pull_request') {
    // Set the head ref to associate a deployment with the pull request
    assertPullRequestPayload(context.payload.pull_request)
    return context.payload.pull_request.head.ref
  }
  return context.ref
}

type RequestError = Error & { status: number }

const isRequestError = (error: unknown): error is RequestError =>
  error instanceof Error && 'status' in error && typeof error.status === 'number'
