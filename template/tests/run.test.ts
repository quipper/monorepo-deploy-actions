import { expect, test } from 'vitest'
import { run } from '../src/run.js'

test('run successfully', async () => {
  await expect(run({ name: 'foo' })).resolves.toBeUndefined()
})
