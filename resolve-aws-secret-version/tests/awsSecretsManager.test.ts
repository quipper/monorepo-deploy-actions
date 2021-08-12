import * as aws from 'aws-sdk'
import * as awsSecretsManager from '../src/awsSecretsManager'

const secretsManagerMock = {
  listSecretVersionIds: jest.fn(),
}
jest.mock('aws-sdk', () => ({
  SecretsManager: jest.fn(() => secretsManagerMock),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

test('getCurrentVersionId returns the current version id', async () => {
  secretsManagerMock.listSecretVersionIds.mockReturnValue({
    // this is an actual payload of the command:
    // $ aws secretsmanager list-secret-version-ids --secret-id tara-content/develop-tara
    // eslint-disable-next-line @typescript-eslint/require-await
    promise: async (): Promise<aws.SecretsManager.ListSecretVersionIdsResponse> => ({
      Versions: [
        {
          VersionId: 'cf06c560-f2c1-4150-a322-0d2120f7c12e',
          VersionStages: ['AWSCURRENT'],
          LastAccessedDate: new Date('2021-05-03T09:00:00+09:00'),
          CreatedDate: new Date('2021-02-03T19:20:03.322000+09:00'),
        },
        {
          VersionId: 'bad358af-9ec4-490a-9609-c62acd284576',
          VersionStages: ['AWSPREVIOUS'],
          LastAccessedDate: new Date('2021-05-03T09:00:00+09:00'),
          CreatedDate: new Date('2020-12-17T14:47:00.020000+09:00'),
        },
      ],
      ARN: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:tara-content/develop-tara-3zcyRx',
      Name: 'tara-content/develop-tara',
    }),
  })

  const versionId = await awsSecretsManager.getCurrentVersionId('my-secret/develop')
  expect(secretsManagerMock.listSecretVersionIds).toBeCalled()
  expect(versionId).toBe('cf06c560-f2c1-4150-a322-0d2120f7c12e')
})
