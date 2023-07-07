import * as core from '@actions/core'
import * as path from 'path'

export const computeRefsToDelete = (
  refs: string[],
  retainPullRequestNumbers: string[],
  namespacePrefix: string,
): string[] => {
  const refsToDelete: string[] = []
  for (const ref of refs) {
    const namespace = path.basename(ref)

    if (!namespace.startsWith(namespacePrefix)) {
      core.info(`${ref}: skip`)
      continue
    }
    const pullRequestNumber = namespace.substring(namespacePrefix.length)
    if (retainPullRequestNumbers.some((n) => n === pullRequestNumber)) {
      core.info(`${ref}: retain`)
      continue
    }
    core.info(`${ref}: delete`)
    refsToDelete.push(ref)
  }
  return refsToDelete
}
