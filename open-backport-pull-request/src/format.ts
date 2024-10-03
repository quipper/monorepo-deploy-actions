import { Context } from './github'

type CommitMessageParams = {
  headBranch: string
  baseBranch: string
  skipCI: boolean
}

export const getCommitMessage = (params: CommitMessageParams, context: Context): string => {
  // https://docs.github.com/en/actions/managing-workflow-runs/skipping-workflow-runs
  const skipCI = params.skipCI ? ' [skip ci]' : ''

  return `Backport from ${params.headBranch} into ${params.baseBranch}${skipCI}

${workflowUrl(context)}`
}

type PullRequestParams = {
  headBranch: string
  baseBranch: string
  pullRequestTitle: string
  pullRequestBody: string
}

export const getPullRequestTitle = (params: PullRequestParams): string =>
  params.pullRequestTitle.replaceAll('HEAD_BRANCH', params.headBranch).replaceAll('BASE_BRANCH', params.baseBranch)

export const getPullRequestBody = (params: PullRequestParams, context: Context): string =>
  `${params.pullRequestBody.replaceAll('HEAD_BRANCH', params.headBranch).replaceAll('BASE_BRANCH', params.baseBranch)}

----
${workflowUrl(context)}`

const workflowUrl = (context: Context) =>
  `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`
