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
  await exec.exec('git', ['init', '--initial-branch', opts.branch], { cwd })
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

export const status = async (cwd: string): Promise<string> => {
  const output = await exec.getExecOutput('git', ['status', '--porcelain'], { cwd })
  return output.stdout.trim()
}
