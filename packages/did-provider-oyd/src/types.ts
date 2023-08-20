import { IAgentContext, IDIDManager, IKeyManager, IService, MinimalImportableKey, TKeyType } from '@veramo/core'

export interface IKeyOpts {
    key?: Partial<MinimalImportableKey> // Optional key to import with only privateKeyHex mandatory. If not specified a key with random kid will be created
    x509?: X509Opts
    type?: TKeyType | 'RSA' // The key type. Defaults to Secp256k1
    isController?: boolean // Whether this is a controller key for a DID document. Please note that only one key can be a controller key. If multiple are supplied, the first one will be used!
  }
  
export interface ICreateIdentifierArgs {
    services?: IService[]
    kms?: string
    alias: string
    options?: { keys?: IKeyOpts | IKeyOpts[] }
  }
  