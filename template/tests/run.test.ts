import { run } from '../src/run.js'
import { test, expect } from 'vitest'

test('run successfully', async () => {
  await expect(run({ name: 'foo' })).resolves.toBeUndefined()
})
