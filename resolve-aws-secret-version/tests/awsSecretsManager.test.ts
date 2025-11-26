import { ListSecretVersionIdsCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { mockClient } from 'aws-sdk-client-mock'
import { expect, it } from 'vitest'
import * as awsSecretsManager from '../src/awsSecretsManager.js'

const secretsManagerMock = mockClient(SecretsManagerClient)

it('returns the current version id', async () => {
  secretsManagerMock.on(ListSecretVersionIdsCommand, { SecretId: 'microservice/develop' }).resolves(
    // this is an actual payload of the command:
    // $ aws secretsmanager list-secret-version-ids --secret-id microservice/develop
    {
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
      ARN: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:microservice/develop-3zcyRx',
      Name: 'microservice/develop',
    },
  )

  const versionId = await awsSecretsManager.getCurrentVersionId('microservice/develop')
  expect(versionId).toBe('cf06c560-f2c1-4150-a322-0d2120f7c12e')
})
