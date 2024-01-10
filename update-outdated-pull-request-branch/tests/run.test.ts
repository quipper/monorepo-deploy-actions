import { isExpired } from '../src/run'

describe('isExpired', () => {
  const now = () => Date.parse('2021-02-03T04:05:06Z')

  it('should return true if expired', () => {
    const headCommitDate = '2021-01-31T00:00:00Z'
    const expirationDays = 3
    expect(isExpired(now, headCommitDate, expirationDays)).toBeTruthy()
  })

  it('should return false if not expired', () => {
    const headCommitDate = '2021-02-02T00:00:00Z'
    const expirationDays = 3
    expect(isExpired(now, headCommitDate, expirationDays)).toBeFalsy()
  })
})
