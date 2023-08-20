import { asDidWeb } from '@sphereon/ssi-sdk-ext.did-utils'
import { importProvidedOrGeneratedKey } from '@sphereon/ssi-sdk-ext.key-utils'
import { IAgentContext, IIdentifier, IKey, IKeyManager, IService } from '@veramo/core'
import { AbstractIdentifierProvider } from '@veramo/did-manager'

import Debug from 'debug'
import { ICreateIdentifierArgs, IKeyOpts } from './types'

const debug = Debug('sphereon:oyd-did:identifier-provider')

type IContext = IAgentContext<IKeyManager>

/**
 * {@link @veramo/did-manager#DIDManager} identifier provider for `did:oyd` identifiers
 * @public
 */
export class OydDIDProvider extends AbstractIdentifierProvider {
  private readonly defaultKms: string

  constructor(options: { defaultKms: string }) {
    super()
    this.defaultKms = options.defaultKms
  }

/*
  Create operation: 
  https://github.com/OwnYourData/oydid/tree/main/uni-registrar-driver-did-oyd#create-operation
  * empty DID
    curl -X POST https://oydid-registrar.data-container.net/1.0/create
  * available options
    {
        "options":{"log_create":{...},"log_terminate":{...}},
        "didDocument":{"doc":{...},"key":"...","log":"..."}
        OR
        "didDocument":{"@context": "https://www.w3.org/ns/did/v1","authentication": [],"service": [...]}
    }
  * response
    {
        "didState": {
            "did": "did:oyd:zQm...",
            "state": "finished",
            "secret": {...},
            "didDocument": {...W3C-DID...}
        },
        "didRegistrationMetadata": {},
        "didDocumentMetadata": {
            "did": "did:oyd:zQm...",
            "registry": "https://oydid.ownyourdata.eu",
            "log_hash": "zQm...",
            "log": [...]
        }
    }
*/

  async createIdentifier(args: ICreateIdentifierArgs, context: IContext): Promise<Omit<IIdentifier, 'provider'>> {
    const { kms, alias } = args
    const opts = args.options ?? {}
    if (!opts.keys || (Array.isArray(opts.keys) && opts.keys.length === 0)) {
      // Let's generate a key as no import keys or types are provided
      opts.keys = [{ type: 'Secp256r1', isController: true }]
    }
    const keyOpts = typeof opts.keys === 'object' ? [opts.keys as IKeyOpts] : opts.keys
    const keys = await Promise.all(
      keyOpts.map((keyOpt) =>
        importProvidedOrGeneratedKey({ kms: kms ?? this.defaultKms, options: Array.isArray(keyOpt) ? keyOpt[0] : keyOpt }, context)
      )
    )

    const controllerIdx = keyOpts.findIndex((opt) => opt.isController)
    const controllerKeyId = controllerIdx < 0 ? keys[0].kid : keys[controllerIdx].kid
    const identifier: Omit<IIdentifier, 'provider'> = {
      did: await asDidWeb(alias),
      controllerKeyId,
      keys,
      services: args.services ?? [],
    }
    debug('Created', identifier.did)
    return identifier
  }

/*
  Update operation: 
  https://github.com/OwnYourData/oydid/tree/main/uni-registrar-driver-did-oyd#update-operation
  * invoke
    echo '{..options..}' | curl -H "Content-Type: application/json" -d @- -X POST https://oydid-registrar.data-container.net/1.0/update
  * required options
    {
        "identifier": "did:oyd:zQm...old-DID",
        "secret": {
            "old_doc_pwd": "...",
            "old_rev_pwd": "..."
        },
        "didDocument":{"doc":{...},"key":"...","log":"..."}
        OR
        "didDocument":{"@context": "https://www.w3.org/ns/did/v1","authentication": [],"service": [...]}
    }

  * response
    {
        "didState": {
            "did": "did:oyd:zQm...",
            "state": "finished",
            "secret": {...},
            "didDocument": {...updateed W3C-DID...}
        },
        "didRegistrationMetadata": {},
        "didDocumentMetadata": {
            "did": "did:oyd:zQm...",
            "registry": "https://oydid.ownyourdata.eu",
            "log_hash": "zQm...",
            "log": [...]
        }
    }
*/

  async updateIdentifier(
    args: {
      did: string
      kms?: string | undefined
      alias?: string | undefined
      options?: any
    },
    context: IAgentContext<IKeyManager>
  ): Promise<IIdentifier> {
    throw new Error('WebDIDProvider updateIdentifier not supported yet.')
  }

/*
  Deactivate operation: 
  https://github.com/OwnYourData/oydid/tree/main/uni-registrar-driver-did-oyd#deactivate-operation
  * invoke
    echo '{..options..}' | curl -H "Content-Type: application/json" -d @- -X POST https://oydid-registrar.data-container.net/1.0/deactivate
  * required options
    {
        "identifier": "did:oyd:zQm...old-DID",
        "options": { "log_revoke": {...}}
    }

  * response
    {
        "didState": {
            "did": "did:oyd:zQm...deactivated-DID",
            "state": "finished"
        },
        "didRegistrationMetadata": {},
        "didDocumentMetadata": {
            "did": "did:oyd:zQm...deactivated-DID",
            "registry": "https://oydid.ownyourdata.eu"
        }
    }
*/

  async deleteIdentifier(identifier: IIdentifier, context: IContext): Promise<boolean> {
    for (const { kid } of identifier.keys) {
      await context.agent.keyManagerDelete({ kid })
    }
    return true
  }

  async addKey(
    {
      identifier,
      key,
      options,
    }: {
      identifier: IIdentifier
      key: IKey
      options?: any
    },
    context: IContext
  ): Promise<any> {
    return { success: true }
  }

  async addService(
    {
      identifier,
      service,
      options,
    }: {
      identifier: IIdentifier
      service: IService
      options?: any
    },
    context: IContext
  ): Promise<any> {
    return { success: true }
  }

  async removeKey(args: { identifier: IIdentifier; kid: string; options?: any }, context: IContext): Promise<any> {
    return { success: true }
  }

  async removeService(args: { identifier: IIdentifier; id: string; options?: any }, context: IContext): Promise<any> {
    return { success: true }
  }
}
