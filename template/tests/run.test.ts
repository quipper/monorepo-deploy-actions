import assert from 'node:assert'
import { test } from 'node:test'
import { run } from '../src/run.ts'

test('run successfully', async () => {
  assert.strictEqual(await run({ name: 'foo' }), undefined)
})
