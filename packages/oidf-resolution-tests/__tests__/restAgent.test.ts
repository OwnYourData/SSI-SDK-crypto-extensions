import { IdentifierResolution, IIdentifierResolution } from '../../identifier-resolution/src' // FIXME fix when new types have been absorbed throughout ssi-sdk
import { SphereonKeyManager } from '@sphereon/ssi-sdk-ext.key-manager'
import { SphereonKeyManagementSystem } from '@sphereon/ssi-sdk-ext.kms-local'

import { createAgent, IAgent, IAgentOptions, IKeyManager, TAgent } from '@veramo/core'
import { Entities, KeyStore, migrations, PrivateKeyStore } from '@veramo/data-store'
import { SecretBox } from '@veramo/kms-local'
import { AgentRestClient } from '@veramo/remote-client'
import { AgentRouter, RequestWithAgentRouter } from '@veramo/remote-server'
import { OrPromise } from '@veramo/utils'

// @ts-ignore
import express from 'express'
import { Server } from 'http'
import { DataSource } from 'typeorm'

import oidfResolutionTests from './shared/oidfResolutionTest'
import { ResourceResolver } from '@sphereon/ssi-sdk.resource-resolver'
import { OIDFClient } from '@sphereon/ssi-sdk.oidf-client'
import { IJwtService, JwtService } from '@sphereon/ssi-sdk-ext.jwt-service'

jest.setTimeout(30000)

const databaseFile = ':memory:'
const port = 13213
const basePath = '/agent'

119f7e793cc2899e99b64b88ca8603db986700089532b'

let serverAgent: IAgent
let clientAgent: TAgent<IKeyManager & IIdentifierResolution & IJwtService>
let restServer: Server
let dbConnection: OrPromise<DataSource>

const KMS_SECRET_KEY = 'd17c8674f5db9396f8eecccde25e882bb0336316bc411ae38dc1f3dcd7ed100f'

const getAgent = (options?: IAgentOptions) => {
  if (!serverAgent) {
    throw Error('Server agent not available yet (missed await?)')
  }
  if (!clientAgent) {
    clientAgent = createAgent<IIdentifierResolution & IKeyManager & IJwtService>({
      ...options,
      plugins: [
        new AgentRestClient({
          url: 'http://localhost:' + port + basePath,
          enabledMethods: serverAgent.availableMethods(),
          schema: serverAgent.getSchema(),
        }),
      ],
    })
  }

  return clientAgent
}

const setup = async (): Promise<boolean> => {
  if (serverAgent) {
    return true
  }
  const db: OrPromise<DataSource> = new DataSource({
    type: 'sqlite',
    database: databaseFile,
    synchronize: false,
    logging: ['info', 'warn'],
    entities: [...Entities],
    migrations: [...migrations],
    migrationsRun: true,
  }).initialize()

  const secretBox = new SecretBox(KMS_SECRET_KEY)

  const agent = createAgent<IKeyManager & IIdentifierResolution & IJwtService>({
    plugins: [
      new SphereonKeyManager({
        store: new KeyStore(db),
        kms: {
          local: new SphereonKeyManagementSystem(new PrivateKeyStore(db, secretBox)),
        },
      }),
      new IdentifierResolution(),
      new JwtService(),
      new ResourceResolver(),
      new OIDFClient(),
    ],
  })

  serverAgent = agent
  dbConnection = db

  const agentRouter = AgentRouter({
    exposedMethods: serverAgent.availableMethods(),
  })

  const requestWithAgent = RequestWithAgentRouter({
    agent: serverAgent,
  })

  return new Promise((resolve) => {
    const app = express()
    app.use(basePath, requestWithAgent, agentRouter)
    restServer = app.listen(port, () => {
      resolve(true)
    })
  })
}

const tearDown = async (): Promise<boolean> => {
  restServer.close()
  await (await dbConnection).dropDatabase()
  return true
}

const testContext = { getAgent, setup, tearDown }

describe('REST integration tests', () => {
  oidfResolutionTests(testContext)
})
