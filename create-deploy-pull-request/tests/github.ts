import * as github from '@actions/github'
import { setupServer } from 'msw/node'

export const server = setupServer()

export const getOctokit = () => github.getOctokit('GITHUB_TOKEN', { request: { fetch } })
