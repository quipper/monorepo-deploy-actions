import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as os from 'os'
import * as path from 'path'
import { promises as fs } from 'fs'

type CheckoutOptions = {
  repository: string
  branch: string
  token: string
}

export const checkout = async (opts: CheckoutOptions) => {
  const cwd = await fs.mkdtemp(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'git-'))
  core.info(`Cloning ${opts.repository} into ${cwd}`)
  await exec.exec('git', ['version'], { cwd })
  await exec.exec('git', ['init'], { cwd })
  await exec.exec('git', ['config', '--local', 'gc.auto', '0'], { cwd })
  await exec.exec('git', ['remote', 'add', 'origin', `https://github.com/${opts.repository}`], { cwd })
  const credentials = Buffer.from(`x-access-token:${opts.token}`).toString('base64')
  core.setSecret(credentials)
  await exec.exec(
    'git',
    ['config', '--local', 'http.https://github.com/.extraheader', `AUTHORIZATION: basic ${credentials}`],
    { cwd },
  )
  await exec.exec(
    'git',
    ['fetch', '--no-tags', '--depth=1', 'origin', `+refs/heads/${opts.branch}:refs/remotes/origin/${opts.branch}`],
    { cwd },
  )
  await exec.exec('git', ['checkout', opts.branch], { cwd })
  return cwd
}

export const getLastCommitDate = async (cwd: string, branch: string): Promise<Date | undefined> => {
  const code = await exec.exec('git', ['fetch', '--no-tags', '--depth=1', 'origin', `refs/heads/${branch}`], {
    cwd,
    ignoreReturnCode: true,
  })
  if (code !== 0) {
    return // ref not found
  }
  const { stdout } = await exec.getExecOutput(
    'git',
    [
      'log',
      '-1',
      // --date=iso-strict (or --date=iso8601-strict) shows timestamps in strict ISO 8601 format.
      '--date=iso8601-strict',
      // %cd = committer date (format respects --date= option)
      '--pretty=format:%cd',
      `origin/refs/heads/${branch}`,
    ],
    {
      cwd,
    },
  )
  const lastCommitDate = Date.parse(stdout.trim())
  if (!Number.isSafeInteger(lastCommitDate)) {
    return // invalid date
  }
  return new Date(lastCommitDate)
}

export const commit = async (cwd: string, message: string): Promise<void> => {
  await exec.exec('git', ['add', '.'], { cwd })
  await exec.exec('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], { cwd })
  await exec.exec('git', ['config', 'user.name', 'github-actions[bot]'], { cwd })
  await exec.exec('git', ['commit', '-m', message], { cwd })
}

export const pushByFastForward = async (cwd: string): Promise<number> => {
  return await exec.exec('git', ['push', 'origin'], { cwd, ignoreReturnCode: true })
}
