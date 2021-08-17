import { computeRefsToDelete } from '../src/delete'

const refs = [
  'refs/heads/ns/monorepo-deploy-actions/staging/pr-100',
  'refs/heads/ns/monorepo-deploy-actions/staging/pr-200',
  'refs/heads/ns/monorepo-deploy-actions/staging/pr-300',
]

test('do nothing when no branch', () => {
  const refsToDelete = computeRefsToDelete([], [], 'pr-')
  expect(refsToDelete).toEqual([])
})

test('delete all', () => {
  const refsToDelete = computeRefsToDelete(refs, [], 'pr-')
  expect(refsToDelete).toEqual(refs)
})

test('retain some namespace', () => {
  const refsToDelete = computeRefsToDelete(refs, ['200'], 'pr-')
  expect(refsToDelete).toEqual([
    'refs/heads/ns/monorepo-deploy-actions/staging/pr-100',
    'refs/heads/ns/monorepo-deploy-actions/staging/pr-300',
  ])
})

test('retain all namespaces', () => {
  const refsToDelete = computeRefsToDelete(refs, ['100', '200', '300'], 'pr-')
  expect(refsToDelete).toEqual([])
})
