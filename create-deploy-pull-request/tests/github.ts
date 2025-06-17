import { Octokit } from '@octokit/action'
import { setupServer } from 'msw/node'

export const server = setupServer()

export const getOctokit = () =>
  new Octokit({
    // Remove @octokit/auth-action
    authStrategy: null,
    // Use the global fetch function instead of the one from @octokit/action
    request: { fetch },
  })
