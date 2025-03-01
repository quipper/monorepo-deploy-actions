import * as core from '@actions/core'
import * as github from '@actions/github'
import { Environment } from './rule.js'
import { Octokit, assertPullRequestPayload } from './github.js'
import assert from 'assert'

type Context = Pick<typeof github.context, 'eventName' | 'repo' | 'ref' | 'payload'>

export type EnvironmentWithDeployment = Environment & {
  // URL of the GitHub Deployment
  // e.g. https://api.github.com/repos/octocat/example/deployments/1
  'github-deployment-url': string
}

export const createGitHubDeploymentForEnvironments = async (
  octokit: Octokit,
  context: Context,
  environments: Environment[],
  service: string,
): Promise<EnvironmentWithDeployment[]> => {
  const environmentsWithDeployments = []
  for (const environment of environments) {
    const { overlay, namespace } = environment
    if (overlay && namespace && service) {
      const deployment = await createDeployment(octokit, context, overlay, namespace, service)
      environmentsWithDeployments.push({
        ...environment,
        'github-deployment-url': deployment.url,
      })
    }
  }
  return environmentsWithDeployments
}

const createDeployment = async (
  octokit: Octokit,
  context: Context,
  overlay: string,
  namespace: string,
  service: string,
) => {
  const environment = `${overlay}/${namespace}/${service}`

  core.info(`Finding the old deployments for environment ${environment}`)
  const oldDeployments = await octokit.rest.repos.listDeployments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    environment,
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
  core.info(`Creating a deployment for environment=${environment}, ref=${ref}`)
  const created = await octokit.rest.repos.createDeployment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref,
    environment,
    auto_merge: false,
    required_contexts: [],
    transient_environment: context.eventName === 'pull_request',
    payload: { overlay, namespace, service },
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
