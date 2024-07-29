import { IKey, ManagedKeyInfo, MinimalImportableKey, TKeyType } from '@veramo/core'
import {
  KeyAlgorithmType,
  KeyGenReq,
  MusapKey,
  MusapModuleType,
  signatureAlgorithmFromKeyAlgorithm,
  SignatureAlgorithmType,
  SignatureFormat,
  SignatureReq,
} from '@sphereon/musap-react-native'
import { SscdType } from '@sphereon/musap-react-native/src/types/musap-types'
import { AbstractKeyManagementSystem } from '@veramo/key-manager'
import { v4 as uuid } from 'uuid'
import { TextDecoder } from 'text-encoding'
import { Loggers } from '@sphereon/ssi-types'

export const logger = Loggers.DEFAULT.get('sphereon:musap-rn-kms')

export class MusapKeyManagementSystem extends AbstractKeyManagementSystem {
  private musapKeyStore: MusapModuleType
  private sscdType: SscdType

  constructor(keyStore: MusapModuleType, sscdType?: SscdType) {
    super()
    this.musapKeyStore = keyStore
    this.sscdType = sscdType ? sscdType : 'TEE'
    this.musapKeyStore.enableSscd(this.sscdType)
  }

  async listKeys(): Promise<ManagedKeyInfo[]> {
    const keysJson: MusapKey[] = (await this.musapKeyStore.listKeys()) as MusapKey[]
    return keysJson.map((key) => this.asMusapKeyInfo(key))
  }

  async createKey(args: { type: TKeyType; keyAlias?: string; [x: string]: any }): Promise<ManagedKeyInfo> {
    const keyAlgorithm = this.mapKeyTypeToAlgorithmType(args.type)
    const attributes = 'attributes' in args ? args.attributes : null
    const keyAlias = args.keyAlias ? args.keyAlias : uuid()
    const keyGenReq: KeyGenReq = {
      keyAlgorithm: keyAlgorithm,
      keyUsage: 'sign',
      keyAlias,
      ...(attributes && { ...attributes }),
      role: 'administrator',
    }

    try {
      const generatedKeyUri = await this.musapKeyStore.generateKey(this.sscdType, keyGenReq)
      if (generatedKeyUri) {
        logger.debug('Generated key:', generatedKeyUri)
        const key = await this.musapKeyStore.getKeyByUri(generatedKeyUri)
        return this.asMusapKeyInfo(key)
      } else {
        throw new Error('Failed to generate key')
      }
    } catch (error) {
      console.error('An error occurred:', error)
      throw error
    }
  }

  mapKeyTypeToAlgorithmType = (type: TKeyType): KeyAlgorithmType => {
    switch (type) {
      case 'Secp256k1':
        return 'ECCP256K1'
      case 'Secp256r1':
        return 'ECCP256R1'
      case 'RSA':
        return 'RSA2K'
      default:
        throw new Error(`Key type ${type} is not supported by MUSAP`)
    }
  }

  mapAlgorithmTypeToKeyType = (type: KeyAlgorithmType): TKeyType => {
    switch (type) {
      case 'ECCP256K1':
        return 'Secp256k1'
      case 'ECCP256R1':
        return 'Secp256r1'
      case 'RSA2K':
        return 'RSA'
      default:
        throw new Error(`Key type ${type} is not supported.`)
    }
  }

  async deleteKey({ kid }: { kid: string }): Promise<boolean> {
    try {
      await this.musapKeyStore.removeKey(kid)
      return true
    } catch (error) {
      console.warn('Failed to delete key:', error)
      return false
    }
  }

  async sign(args: { keyRef: Pick<IKey, 'kid'>; algorithm?: string; data: Uint8Array; [x: string]: any }): Promise<string> {
    if (!args.keyRef) {
      throw new Error('key_not_found: No key ref provided')
    }

    const data = new TextDecoder().decode(args.data as Uint8Array)

    const key: MusapKey = this.musapKeyStore.getKeyById(args.keyRef.kid) as MusapKey
    const signatureReq: SignatureReq = {
      keyUri: key.keyUri,
      data,
      algorithm: (args.algorithm as SignatureAlgorithmType) ?? signatureAlgorithmFromKeyAlgorithm(key.algorithm),
      displayText: args.displayText,
      transId: args.transId,
      format: (args.format as SignatureFormat) ?? 'RAW',
      attributes: args.attributes,
    }
    return this.musapKeyStore.sign(signatureReq)
  }

  async importKey(args: Omit<MinimalImportableKey, 'kms'> & { privateKeyPEM?: string }): Promise<ManagedKeyInfo> {
    throw new Error('Not implemented.')
  }

  private asMusapKeyInfo(args: MusapKey): ManagedKeyInfo {
    const keyInfo: Partial<ManagedKeyInfo> = {
      kid: args.keyId,
      type: this.mapAlgorithmTypeToKeyType(args.keyType),
      publicKeyHex: args.publicKey.toString(),
      meta: {
        ...args,
      },
    }
    return keyInfo as ManagedKeyInfo
  }

  sharedSecret(args: { myKeyRef: Pick<IKey, 'kid'>; theirKey: Pick<IKey, 'publicKeyHex' | 'type'> }): Promise<string> {
    throw new Error('Not supported.')
  }
}
