import assert from 'node:assert'

export type Context = {
  repo: {
    owner: string
    repo: string
  }
  serverUrl: string
  sha: string
  runId: string
}

export const getContext = (): Context => {
  // https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables
  return {
    repo: getRepo(),
    serverUrl: getEnv('GITHUB_SERVER_URL'),
    sha: getEnv('GITHUB_SHA'),
    runId: getEnv('GITHUB_RUN_ID'),
  }
}

const getRepo = () => {
  const [owner, repo] = getEnv('GITHUB_REPOSITORY').split('/')
  return { owner, repo }
}

const getEnv = (name: string): string => {
  assert(process.env[name], `${name} is required`)
  return process.env[name]
}
