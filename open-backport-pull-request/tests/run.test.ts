import { getHeadBranch } from '../src/run'
import { Context } from '@actions/github/lib/context'

describe('#getHeadBranch', () => {
  describe('when workflow_dispatch event', () => {
    test('run successfully', () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const context = {
        eventName: 'workflow_dispatch',
        payload: {
          inputs: {
            headBranch: 'foo-branch',
          },
        },
      } as Context
      const headBranch = getHeadBranch(context)
      expect(headBranch).toEqual('foo-branch')
    })
  })

  describe('when push event', () => {
    test('run successfully', () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const context = {
        eventName: 'push',
        ref: 'refs/heads/bar-branch',
      } as Context
      const headBranch = getHeadBranch(context)
      expect(headBranch).toEqual('bar-branch')
    })
  })
})
