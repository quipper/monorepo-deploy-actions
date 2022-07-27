import * as core from '@actions/core'
import * as exec from '@actions/exec'

export const init = async (cwd: string, owner: string, repo: string, token: string): Promise<void> => {
  await exec.exec('git', ['version'], { cwd })
  await exec.exec('git', ['init'], { cwd })
  await exec.exec('git', ['remote', 'add', 'origin', `https://github.com/${owner}/${repo}`], { cwd })
  await exec.exec('git', ['config', '--local', 'gc.auto', '0'], { cwd })

  const credentials = Buffer.from(`x-access-token:${token}`).toString('base64')
  core.setSecret(credentials)
  await exec.exec(
    'git',
    ['config', '--local', 'http.https://github.com/.extraheader', `AUTHORIZATION: basic ${credentials}`],
    {
      cwd,
    }
  )
}

export const checkoutIfExist = async (cwd: string, branch: string): Promise<number> => {
  const fetchCode = await exec.exec(
    'git',
    [
      '-c',
      'protocol.version=2',
      'fetch',
      '--no-tags',
      '--prune',
      '--no-recurse-submodules',
      '--depth=1',
      'origin',
      `+refs/heads/${branch}:refs/remotes/origin/${branch}`,
    ],
    { cwd, ignoreReturnCode: true }
  )
  if (fetchCode === 0) {
    await exec.exec('git', ['branch', '--list', '--remote', `origin/${branch}`], { cwd })
    await exec.exec('git', ['checkout', '--progress', '--force', branch], { cwd })
  }
  return fetchCode
}

export const status = async (cwd: string): Promise<string> => {
  const output = await exec.getExecOutput('git', ['status', '--porcelain'], { cwd })
  return output.stdout.trim()
}

export const commit = async (cwd: string, message: string): Promise<void> => {
  await exec.exec('git', ['add', '.'], { cwd })
  await exec.exec('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], { cwd })
  await exec.exec('git', ['config', 'user.name', 'github-actions[bot]'], { cwd })
  await exec.exec('git', ['commit', '-m', message], { cwd })
}

export const pushByFastForward = async (cwd: string, branch: string): Promise<number> => {
  return await exec.exec('git', ['push', 'origin', `HEAD:refs/heads/${branch}`], { cwd, ignoreReturnCode: true })
}

export const deleteRef = async (cwd: string, ref: string): Promise<number> =>
  await exec.exec('git', ['push', '--delete', 'origin', ref], { cwd, ignoreReturnCode: true })
