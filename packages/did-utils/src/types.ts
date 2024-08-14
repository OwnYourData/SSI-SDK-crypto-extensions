import { TKeyType } from '@sphereon/ssi-sdk-ext.key-utils'
import { IAgentContext, IDIDManager, IIdentifier, IKeyManager, IResolver } from '@veramo/core'
import { JWTHeader, JWTPayload, JWTVerifyOptions } from 'did-jwt'
import { Resolvable } from 'did-resolver'

export enum SupportedDidMethodEnum {
  DID_ETHR = 'ethr',
  DID_KEY = 'key',
  DID_LTO = 'lto',
  DID_ION = 'ion',
  DID_EBSI = 'ebsi',
  DID_JWK = 'jwk',
}

export enum IdentifierAliasEnum {
  PRIMARY = 'primary',
}

export enum KeyManagementSystemEnum {
  LOCAL = 'local',
}

export interface ResolveOpts {
  jwtVerifyOpts?: JWTVerifyOptions
  resolver?: Resolvable
  resolveUrl?: string
  noUniversalResolverFallback?: boolean
  subjectSyntaxTypesSupported?: string[]
}

/**
 * @deprecated Replaced by the identifier resolution service
 */
export interface IDIDOptions {
  resolveOpts?: ResolveOpts
  idOpts: LegacyIIdentifierOpts
  supportedDIDMethods?: string[]
}

export type IdentifierProviderOpts = {
  type?: TKeyType
  use?: string
  method?: SupportedDidMethodEnum
  [x: string]: any
}

export type CreateIdentifierOpts = {
  method: SupportedDidMethodEnum
  createOpts?: CreateIdentifierCreateOpts
}

export type CreateIdentifierCreateOpts = {
  kms?: KeyManagementSystemEnum
  alias?: string
  options?: IdentifierProviderOpts
}

export type CreateOrGetIdentifierOpts = {
  method: SupportedDidMethodEnum
  createOpts?: CreateIdentifierCreateOpts
}

export const DID_PREFIX = 'did:'

export interface GetOrCreateResult<T> {
  created: boolean
  result: T
}

/**
 * @deprecated Replaced by new signer
 */
export type SignJwtArgs = {
  idOpts: LegacyIIdentifierOpts
  header: Partial<JWTHeader>
  payload: Partial<JWTPayload>
  options: { issuer: string; expiresIn?: number; canonicalize?: boolean }
  context: IRequiredSignAgentContext
}

/**
 * @deprecated Replaced by new signer
 */
export type GetSignerArgs = {
  idOpts: LegacyIIdentifierOpts
  context: IRequiredSignAgentContext
}

/**
 * @deprecated Replaced by the identifier resolution service
 */
type LegacyIIdentifierOpts = {
  identifier: IIdentifier | string
}
export type IRequiredSignAgentContext = IAgentContext<IKeyManager & IDIDManager & IResolver>
