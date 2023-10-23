import * as core from '@actions/core'
import * as github from '@actions/github'
import { Environment } from './rule'
import { RequestError } from '@octokit/request-error'
import { Octokit, assertPullRequestPayload } from './github'
import assert from 'assert'

type Context = Pick<typeof github.context, 'eventName' | 'repo' | 'ref' | 'payload'>

export const createGitHubDeploymentForEnvironments = async (
  octokit: Octokit,
  context: Context,
  environments: Environment[],
) => {
  for (const environment of environments) {
    if (environment['github-deployment'] === 'true' && environment['github-deployment-environment']) {
      const deploymentEnvironment = environment['github-deployment-environment']
      const deployment = await createDeployment(octokit, context, deploymentEnvironment)
      environment['github-deployment-url'] = deployment.url
    }
  }
}

const createDeployment = async (octokit: Octokit, context: Context, deploymentEnvironment: string) => {
  core.info(`Finding the old deployments for environment ${deploymentEnvironment}`)
  const oldDeployments = await octokit.rest.repos.listDeployments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    environment: deploymentEnvironment,
  })

  core.info(`Deleting ${oldDeployments.data.length} deployment(s)`)
  for (const deployment of oldDeployments.data) {
    try {
      await octokit.rest.repos.deleteDeployment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        deployment_id: deployment.id,
      })
      core.info(`Deleted the old deployment ${deployment.url}`)
    } catch (error) {
      if (error instanceof RequestError) {
        core.warning(`Unable to delete previous deployment ${deployment.url}: ${error.status} ${error.message}`)
        continue
      }
      throw error
    }
  }

  const deploymentRef = getDeploymentRef(context)
  core.info(`Creating a deployment for environment=${deploymentEnvironment}, ref=${deploymentRef}`)
  const created = await octokit.rest.repos.createDeployment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: deploymentRef,
    environment: deploymentEnvironment,
    auto_merge: false,
    required_contexts: [],
    transient_environment: context.eventName === 'pull_request',
  })
  assert.strictEqual(created.status, 201)
  core.info(`Created a deployment ${created.data.url}`)
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
