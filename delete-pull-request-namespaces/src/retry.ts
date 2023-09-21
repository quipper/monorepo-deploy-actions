import * as core from '@actions/core'

type RetrySpec = {
  maxAttempts: number
  waitMs: number
}

export const retryExponential = async <T>(f: Promise<T | Error>, spec: RetrySpec): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    const value = await f
    if (!(value instanceof Error)) {
      return value
    }

    const retryOver = attempt >= spec.maxAttempts
    if (retryOver) {
      throw value
    }

    const waitMs = Math.ceil(Math.pow(attempt, 2) + Math.random() * spec.waitMs)
    core.warning(`Retrying after ${waitMs} ms: ${String(value)}`)
    await sleep(waitMs)
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
