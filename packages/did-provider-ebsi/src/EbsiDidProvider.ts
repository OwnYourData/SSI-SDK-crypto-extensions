import { getControllerKey, getEthereumAddressFromKey } from '@sphereon/ssi-sdk-ext.did-utils'
import { calculateJwkThumbprint, calculateJwkThumbprintForKey, toJwk } from '@sphereon/ssi-sdk-ext.key-utils'
import { IAgentContext, IDIDManager, IIdentifier, IKeyManager } from '@veramo/core'
import { IKey, IService } from '@veramo/core/build/types/IIdentifier'
import { AbstractIdentifierProvider } from '@veramo/did-manager/build/abstract-identifier-provider'
import Debug from 'debug'
import {
  ebsiCreateDidOnLedger,
  ebsiGenerateOrUseKeyPair,
  ebsiSignAndSendTransaction,
  formatEbsiPublicKey,
  generateEbsiMethodSpecificId,
  randomRpcId,
} from './functions'
import { callRpcMethod } from './services/EbsiRPCService'
import { ApiOpts, EBSI_DID_SPEC_INFOS, EbsiRpcMethod, IContext, ICreateIdentifierArgs, UpdateIdentifierParams } from './types'

const debug = Debug('sphereon:did-provider-ebsi')

export class EbsiDidProvider extends AbstractIdentifierProvider {
  static readonly PROVIDER = 'did:ebsi'
  private readonly defaultKms?: string
  private readonly apiOpts?: ApiOpts

  constructor(options: { defaultKms?: string; apiOpts?: ApiOpts }) {
    super()
    this.defaultKms = options.defaultKms
    this.apiOpts = options.apiOpts
  }

  async createIdentifier(args: ICreateIdentifierArgs, context: IContext): Promise<Omit<IIdentifier, 'provider'>> {
    const { type, options, kms = this.defaultKms, alias } = args
    const { notBefore, notAfter, secp256k1Key, secp256r1Key, bearerToken, executeLedgerOperation = false, methodSpecificId = generateEbsiMethodSpecificId(EBSI_DID_SPEC_INFOS.V1) } = { ...options }

    if (executeLedgerOperation && !bearerToken) {
      throw new Error('Bearer token must be provided to execute ledger operation')
    }
    const rpcId = options?.rpcId ?? randomRpcId()

    if (type === EBSI_DID_SPEC_INFOS.KEY) {
      throw new Error(`Type ${type} not supported. Please use @sphereon/ssi-sdk-ext.did-provider-key for Natural Person EBSI DIDs`)
    } else if (!kms) {
      return Promise.reject(Error(`No KMS value provided`))
    }

    // CapabilityInvocation purpose
    const secp256k1ImportKey = await ebsiGenerateOrUseKeyPair(
      {
        keyOpts: secp256k1Key,
        keyType: 'Secp256k1',
        kms,
        controllerKey: true,
      },
      context
    )
    const secp256k1ManagedKeyInfo = await context.agent.keyManagerImport(secp256k1ImportKey)

    // Authentication, assertionMethod purpose
    const secp256r1ImportKey = await ebsiGenerateOrUseKeyPair(
      {
        keyOpts: secp256r1Key,
        keyType: 'Secp256r1',
        kms,
      },
      context
    )

    const secp256r1ManagedKeyInfo = await context.agent.keyManagerImport(secp256r1ImportKey)


    const identifier: IIdentifier = {
      did: `${EBSI_DID_SPEC_INFOS.V1.method}${methodSpecificId}`,
      controllerKeyId: secp256k1ManagedKeyInfo.kid,
      keys: [secp256k1ManagedKeyInfo, secp256r1ManagedKeyInfo],
      alias,
      services: [],
      provider: EbsiDidProvider.PROVIDER,
    }

    if (executeLedgerOperation) {
      await ebsiCreateDidOnLedger(
        {
          identifier,
          bearerToken: bearerToken!,
          rpcId,
          notBefore: notBefore ?? Date.now() / 1000,
          notAfter: notAfter ?? Number.MAX_SAFE_INTEGER,
          apiOpts: { ...this.apiOpts, ...options?.apiOpts },
        },
        context
      )
    }

    debug('Created', identifier.did)
    return identifier
  }

  async addKey(
    args: {
      identifier: IIdentifier
      key: IKey
      options: {
        rpcId?: number
        bearerToken: string
        vmRelationships: 'authentication' | 'assertionMethod' | 'keyAgreement' | 'capabilityInvocation' | 'capabilityDelegation'[]
        apiOpts?: ApiOpts
      }
    },
    context: IAgentContext<IKeyManager>
  ): Promise<any> {
    const { identifier, key, options } = args
    const { bearerToken, vmRelationships, apiOpts, rpcId = randomRpcId() } = options
    if (vmRelationships.length === 0) {
      return Promise.reject(Error(`No verification method relationship provided`))
    }
    const controllerKey = getControllerKey({ identifier })
    const from = getEthereumAddressFromKey({ key: controllerKey })

    const addVerificationMethodResponse = await callRpcMethod({
      params: [
        {
          from,
          did: identifier.did,
          isSecp256k1: true,
          vMethodId: calculateJwkThumbprint({ jwk: toJwk(controllerKey.publicKeyHex, 'Secp256k1') }),
          publicKey: formatEbsiPublicKey({ key: controllerKey, type: 'Secp256k1' }),
        },
      ],
      rpcMethod: EbsiRpcMethod.ADD_VERIFICATION_METHOD,
      rpcId,
      apiOpts,
      bearerToken,
    })

    await ebsiSignAndSendTransaction(
      {
        rpcResponse: addVerificationMethodResponse,
        kid: controllerKey.kid,
        bearerToken,
        apiOpts,
      },
      context
    )

    const vMethodId = calculateJwkThumbprintForKey({ key })
    for (const vmRelationshipsKey in vmRelationships as string[]) {
      const addVerificationMethodRelationshipResponse = await callRpcMethod({
        params: [
          {
            from,
            did: identifier.did,
            vMethodId,
            name: vmRelationshipsKey,
            notAfter: 1,
            notBefore: 1,
          },
        ],
        rpcMethod: EbsiRpcMethod.ADD_VERIFICATION_METHOD_RELATIONSHIP,
        rpcId,
        apiOpts,
        bearerToken,
      })
      await ebsiSignAndSendTransaction(
        {
          rpcResponse: addVerificationMethodRelationshipResponse,
          kid: controllerKey.kid,
          bearerToken,
          apiOpts,
        },
        context
      )
    }
  }

  async addService(
    args: {
      identifier: IIdentifier
      service: IService
      options: {
        rpcId?: number
        bearerToken: string
        apiOpts?: ApiOpts
      }
    },
    context: IAgentContext<IKeyManager>
  ): Promise<any> {
    const { identifier, service, options } = args
    const { bearerToken, apiOpts, rpcId = randomRpcId() } = options
    const controllerKey = getControllerKey({ identifier })
    const from = getEthereumAddressFromKey({ key: controllerKey })

    const addServiceResponse = await callRpcMethod({
      params: [
        {
          from,
          did: identifier.did,
          service,
        },
      ],
      rpcMethod: EbsiRpcMethod.ADD_SERVICE,
      rpcId,
      apiOpts,
      bearerToken,
    })

    return await ebsiSignAndSendTransaction(
      {
        rpcResponse: addServiceResponse,
        kid: controllerKey.kid,
        bearerToken,
        apiOpts,
      },
      context
    )
  }

  deleteIdentifier(args: IIdentifier, context: IAgentContext<IKeyManager>): Promise<boolean> {
    return Promise.resolve(true)
  }

  removeKey(
    args: {
      identifier: IIdentifier
      kid: string
      options?: any
    },
    context: IAgentContext<IKeyManager>
  ): Promise<any> {
    throw new Error(`Not (yet) implemented for the EBSI did provider`)
  }

  removeService(
    args: {
      identifier: IIdentifier
      id: string
      options?: any
    },
    context: IAgentContext<IKeyManager>
  ): Promise<any> {
    throw new Error(`Not (yet) implemented for the EBSI did provider`)
  }

  // TODO How does it work? Not inferable from the api: https://hub.ebsi.eu/apis/pilot/did-registry/v5/post-jsonrpc#updatebasedocument
  async updateIdentifier(args: UpdateIdentifierParams, context: IAgentContext<IKeyManager & IDIDManager>): Promise<IIdentifier> {
    throw new Error(`Not (yet) implemented for the EBSI did provider`)
  }
}
