import * as core from '@actions/core'

interface RetrySpec {
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

    const wait = Math.pow(i, 2) + Math.random() * spec.waitMillisecond
    core.warning(`retry after ${wait} ms: ${String(result)}`)
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
}
