import {
  ApiOpts,
  CreateEbsiDidParams,
  EBSI_DID_SPEC_INFOS,
  EbsiDidSpecInfo,
  EbsiEnvironment,
  EbsiKeyType,
  EbsiPublicKeyPurpose,
  EbsiRpcMethod,
  IContext,
  IKeyOpts,
  EbsiRPCResponse,
  Response200,
  EbsiDidRegistryAPIEndpoints,
  BASE_CONTEXT_DOC,
} from './types'
import { randomBytes } from '@ethersproject/random'
import * as u8a from 'uint8arrays'
import { base58btc } from 'multiformats/bases/base58'
import { IAgentContext, IKey, IKeyManager, MinimalImportableKey } from '@veramo/core'
import { getBytes, sha256, sha512, SigningKey, Transaction } from 'ethers'
import { JWK, JwkKeyUse, toJwk } from '@sphereon/ssi-sdk-ext.key-utils'
import { callRpcMethod } from './services/EbsiRPCService'

export const toBase64url = (input: string): string => u8a.toString(u8a.fromString(input), 'base64url')

export function generateEbsiMethodSpecificId(specInfo?: EbsiDidSpecInfo): string {
  const spec = specInfo ?? EBSI_DID_SPEC_INFOS.V1
  const length = spec.didLength ?? 16

  const result = new Uint8Array(length + (spec.version ? 1 : 0))
  if (spec.version) {
    result.set([spec.version])
  }
  result.set(randomBytes(length), spec.version ? 1 : 0)
  return base58btc.encode(result)
}

export function generateEbsiPrivateKeyHex(specInfo?: EbsiDidSpecInfo, privateKeyBytes?: Uint8Array): string {
  const spec = specInfo ?? EBSI_DID_SPEC_INFOS.V1
  const length = spec.didLength ? 2 * spec.didLength : 32

  if (privateKeyBytes) {
    if (privateKeyBytes.length != length) {
      throw Error(`Invalid private key length supplied (${privateKeyBytes.length}. Expected ${length} for ${spec.type}`)
    }
    return u8a.toString(privateKeyBytes, 'base16')
  }
  return u8a.toString(randomBytes(length), 'base16')
}

/**
 * Returns the public key in the correct format to be used with the did registry v5
 * - in case of Secp256k1 - returns the uncompressed public key as hex string prefixed with 0x04
 * - in case of Secp256r1 - returns the jwk public key as hex string
 * @param {{ key: IKey, type: EbsiKeyType }} args
 *  - key is the cryptographic key containing the public key
 *  - type is the type of the key which can be Secp256k1 or Secp256r1
 *  @returns {string} The properly formatted public key
 *  @throws {Error} If the key type is invalid
 */
export const formatEbsiPublicKey = (args: { key: IKey; type: EbsiKeyType }): string => {
  const { key, type } = args
  switch (type) {
    case 'Secp256k1': {
      const bytes = getBytes('0x' + key.publicKeyHex, 'key')
      return SigningKey.computePublicKey(bytes, false)
    }
    case 'Secp256r1': {
      /*
                    Public key as hex string. For an ES256K key, it must be in uncompressed format prefixed with "0x04".
                    For other algorithms, it must be the JWK transformed to string and then to hex format.
                   */
      const jwk: JsonWebKey = toJwk(key.publicKeyHex, type, { use: JwkKeyUse.Signature, key })
      /*
                    Converting JWK to string and then hex is odd and may lead to errors. Implementing
                    it like that because it's how EBSI does it. However, it may be a point of pain
                    in the future.
                   */
      const jwkString = JSON.stringify(jwk, null, 2)
      return u8a.toString(u8a.fromString(jwkString), 'base16')
    }
    default:
      throw new Error(`Invalid key type: ${type}`)
  }
}

export const getRegistryAPIUrls = (args: { environment?: EbsiEnvironment; version?: string }): EbsiDidRegistryAPIEndpoints => {
  const { environment = 'pilot', version = 'v5' } = args
  const baseUrl = `https://api-${environment}.ebsi.eu/did-registry/${version}`
  return {
    mutate: `${baseUrl}/jsonrpc`,
    query: `${baseUrl}/identifiers`,
  }
}

/**
 * EBSI specific way to calculate the JWK thumbprint
 * @param args
 */
export const calculateJwkThumbprint = async (args: { jwk: JWK; digestAlgorithm?: 'sha256' | 'sha512' }): Promise<string> => {
  const { jwk, digestAlgorithm = 'sha256' } = args
  let components
  switch (jwk.kty) {
    case 'EC':
      assertJwkClaimPresent(jwk.crv, '"crv" (Curve) Parameter')
      assertJwkClaimPresent(jwk.x, '"x" (X Coordinate) Parameter')
      assertJwkClaimPresent(jwk.y, '"y" (Y Coordinate) Parameter')
      components = { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }
      break
    case 'OKP':
      assertJwkClaimPresent(jwk.crv, '"crv" (Subtype of Key Pair) Parameter')
      assertJwkClaimPresent(jwk.x, '"x" (Public Key) Parameter')
      components = { crv: jwk.crv, kty: jwk.kty, x: jwk.x }
      break
    case 'RSA':
      assertJwkClaimPresent(jwk.e, '"e" (Exponent) Parameter')
      assertJwkClaimPresent(jwk.n, '"n" (Modulus) Parameter')
      components = { e: jwk.e, kty: jwk.kty, n: jwk.n }
      break
    case 'oct':
      assertJwkClaimPresent(jwk.k, '"k" (Key Value) Parameter')
      components = { k: jwk.k, kty: jwk.kty }
      break
    default:
      throw new Error('"kty" (Key Type) Parameter missing or unsupported')
  }
  const data = u8a.fromString(JSON.stringify(components))
  return toBase64url(digestAlgorithm === 'sha512' ? sha512(data) : sha256(data))
}

const assertJwkClaimPresent = (value: unknown, description: string) => {
  if (typeof value !== 'string' || !value) {
    throw new Error(`${description} missing or invalid`)
  }
}

export const sendLedgerTransaction = async (
  args: {
    docTransactionResponse: EbsiRPCResponse
    kid: string
    rpcId: number
    bearerToken: string
    apiOpts?: ApiOpts
  },
  context: IContext
) => {
  const { docTransactionResponse, bearerToken, kid, rpcId, apiOpts } = args
  if ('status' in args.docTransactionResponse) {
    throw new Error(JSON.stringify(args.docTransactionResponse, null, 2))
  }
  const unsignedTransaction = (docTransactionResponse as Response200).result

  const signedRawTransaction = await context.agent.keyManagerSignEthTX({
    kid,
    transaction: unsignedTransaction,
  })

  const { r, s, v } = Transaction.from(signedRawTransaction).signature!

  const sTResponse = await callRpcMethod({
    params: [
      {
        protocol: 'eth',
        unsignedTransaction,
        r,
        s,
        v: v.toString(),
        signedRawTransaction,
      },
    ],
    rpcMethod: EbsiRpcMethod.SEND_SIGNED_TRANSACTION,
    rpcId,
    apiOpts,
    bearerToken,
  })

  if ('status' in sTResponse) {
    throw new Error(JSON.stringify(sTResponse, null, 2))
  }
}

export const generateEbsiKeyPair = async (
  args: {
    keyOpts?: IKeyOpts
    keyType: EbsiKeyType
    kms?: string
  },
  context: IAgentContext<IKeyManager>
) => {
  const { keyOpts, keyType, kms } = args
  let privateKeyHex = generateEbsiPrivateKeyHex(
    EBSI_DID_SPEC_INFOS.V1,
    keyOpts?.privateKeyHex ? u8a.fromString(keyOpts.privateKeyHex, 'base16') : undefined
  )
  if (privateKeyHex.startsWith('0x')) {
    privateKeyHex = privateKeyHex.substring(2)
  }
  if (!privateKeyHex || privateKeyHex.length !== 64) {
    throw new Error('Private key should be 32 bytes / 64 chars hex')
  }
  return assertedKey({ key: { ...keyOpts, privateKeyHex }, type: keyType, kms })
}

export const assertedKey = (args: { key?: IKeyOpts; type: EbsiKeyType; kms?: string }): MinimalImportableKey => {
  const { key, type, kms } = args
  const minimalImportableKey: Partial<MinimalImportableKey> = { ...key } ?? {}
  minimalImportableKey.kms = assertedKms(kms)
  minimalImportableKey.type = setDefaultKeyType({ key, type })
  minimalImportableKey.meta = { purposes: assertedPurposes({ key }) ?? setDefaultPurposes({ key, type }) }
  return minimalImportableKey as MinimalImportableKey
}

export const assertedKms = (kms?: string) => {
  const result = kms
  if (!!result) {
    return result
  }
  throw new Error('no KMS supplied')
}

export const setDefaultKeyType = (args: { key?: IKeyOpts; type: EbsiKeyType }): EbsiKeyType => {
  if (!args.key?.type) {
    return args.type
  }
  return args.key.type
}

export const assertedPurposes = (args: { key?: IKeyOpts }): EbsiPublicKeyPurpose[] | undefined => {
  const { key } = args
  if (key?.purposes && key.purposes.length > 0) {
    switch (key.type) {
      case 'Secp256k1': {
        if (key?.purposes && key.purposes.length > 0 && key.purposes?.includes(EbsiPublicKeyPurpose.CapabilityInvocation)) {
          return key.purposes
        }
        throw new Error(`Secp256k1 key requires ${EbsiPublicKeyPurpose.CapabilityInvocation} purpose`)
      }
      case 'Secp256r1': {
        if (
          key?.purposes &&
          key.purposes.length > 0 &&
          key.purposes.every((purpose) => [EbsiPublicKeyPurpose.AssertionMethod, EbsiPublicKeyPurpose.Authentication].includes(purpose))
        ) {
          return key.purposes
        }
        throw new Error(`Secp256r1 key requires ${[EbsiPublicKeyPurpose.AssertionMethod, EbsiPublicKeyPurpose.Authentication].join(', ')} purposes`)
      }
      default:
        throw new Error(`Unsupported key type: ${key.type}`)
    }
  }
  return key?.purposes
}

export const setDefaultPurposes = (args: { key?: IKeyOpts; type: EbsiKeyType }): EbsiPublicKeyPurpose[] => {
  const { key, type } = args
  if (!key?.purposes || key.purposes.length === 0) {
    switch (type) {
      case 'Secp256k1':
        return [EbsiPublicKeyPurpose.CapabilityInvocation]
      case 'Secp256r1':
        return [EbsiPublicKeyPurpose.AssertionMethod, EbsiPublicKeyPurpose.Authentication]
      default:
        throw new Error(`Unsupported key type: ${key?.type}`)
    }
  }
  return key.purposes
}

export const randomRpcId = (): number => {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
}

export const createEbsiDidOnLedger = async (args: CreateEbsiDidParams, context: IContext): Promise<void> => {
  const { from, apiOpts, notBefore, notAfter, baseDocument, identifier, secp256k1ManagedKeyInfo, bearerToken } = args
  const rpcId = args.rpcId ?? randomRpcId()
  const insertDidDocTransaction = await callRpcMethod({
    params: [
      {
        from,
        did: identifier.did,
        baseDocument: baseDocument ?? BASE_CONTEXT_DOC,
        vMethoddId: await calculateJwkThumbprint({ jwk: toJwk(secp256k1ManagedKeyInfo.publicKeyHex, 'Secp256k1') }),
        isSecp256k1: true,
        publicKey: formatEbsiPublicKey({ key: secp256k1ManagedKeyInfo, type: 'Secp256k1' }),
        notBefore,
        notAfter,
      },
    ],
    rpcMethod: EbsiRpcMethod.INSERT_DID_DOCUMENT,
    rpcId,
    apiOpts,
    bearerToken,
  })

  await sendLedgerTransaction(
    {
      docTransactionResponse: insertDidDocTransaction,
      kid: args.secp256k1ManagedKeyInfo.kid,
      rpcId,
      bearerToken,
      apiOpts,
    },
    context
  )

  const addVerificationMethodTransaction = await callRpcMethod({
    params: [
      {
        from,
        did: identifier.did,
        isSecp256k1: true,
        vMethoddId: await calculateJwkThumbprint({ jwk: toJwk(args.secp256k1ManagedKeyInfo.publicKeyHex, 'Secp256k1') }),
        publicKey: formatEbsiPublicKey({ key: args.secp256k1ManagedKeyInfo, type: 'Secp256k1' }),
      },
    ],
    rpcMethod: EbsiRpcMethod.ADD_VERIFICATION_METHOD,
    rpcId,
    apiOpts,
    bearerToken,
  })

  await sendLedgerTransaction(
    {
      docTransactionResponse: addVerificationMethodTransaction,
      kid: args.secp256k1ManagedKeyInfo.kid,
      rpcId,
      bearerToken,
      apiOpts,
    },
    context
  )

  const addVerificationMethodRelationshipTransaction = await callRpcMethod({
    params: [
      {
        from: args?.from,
        did: args.identifier.did,
        vMethoddId: await calculateJwkThumbprint({ jwk: toJwk(args.secp256r1ManagedKeyInfo.publicKeyHex, 'Secp256r1') }),
        name: 'assertionMethod',
        notAfter: 1,
        notBefore: 1,
      },
    ],
    rpcMethod: EbsiRpcMethod.ADD_VERIFICATION_METHOD_RELATIONSHIP,
    rpcId,
    apiOpts,
    bearerToken,
  })

  await sendLedgerTransaction(
    {
      docTransactionResponse: addVerificationMethodRelationshipTransaction,
      kid: args.secp256k1ManagedKeyInfo.kid,
      bearerToken,
      rpcId,
      apiOpts,
    },
    context
  )
}
