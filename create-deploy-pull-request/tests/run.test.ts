import { run } from '../src/run.js'
import { getOctokit, server } from './github.js'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

it('should create base branch if not exist', async () => {
  await run(
    {
      head: 'release',
      base: 'production',
      title: 'Deploy service to production',
      body: 'Hello',
      actor: 'octocat',
      labels: [],
      draft: true,
      owner: 'test-owner',
      repo: 'test-repo-1',
      now: () => new Date(Date.UTC(2023, 8, 7, 6, 1, 2, 0)),
      timeZone: 'Asia/Tokyo',
    },
    getOctokit(),
  )
})

it('should create pull request if base branch exists', async () => {
  await run(
    {
      head: 'release',
      base: 'production',
      title: 'Deploy service to production',
      body: 'Hello',
      actor: 'octocat',
      labels: [],
      draft: true,
      owner: 'test-owner',
      repo: 'test-repo-2',
      now: () => new Date(Date.UTC(2023, 8, 7, 6, 1, 2, 0)),
      timeZone: 'Asia/Tokyo', // UTC+9
    },
    getOctokit(),
  )
})
