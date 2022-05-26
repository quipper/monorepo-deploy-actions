import * as core from '@actions/core'
import { RequestError } from '@octokit/request-error'

type RetrySpec = {
  maxAttempts: number
  waitMillisecond: number
}

export const retry = async <T>(f: () => Promise<T | Error>, spec: RetrySpec): Promise<T> => {
  for (let i = 1; ; i++) {
    const result = await f()
    if (!(result instanceof Error)) {
      return result
    }
    if (i >= spec.maxAttempts) {
      throw result
    }

    // Here don't use the exponential algorithm,
    // because a namespace branch will be updated from many jobs concurrently
    const wait = i + Math.random() * spec.waitMillisecond
    core.warning(`retry after ${wait} ms: ${String(result)}`)
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
}

export const catchHttpStatus = async <T>(status: number, f: () => Promise<T>): Promise<T | RequestError> => {
  try {
    return await f()
  } catch (e) {
    if (e instanceof RequestError && e.status === status) {
      return e // retry
    }
    throw e
  }
}
