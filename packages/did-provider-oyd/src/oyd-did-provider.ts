import { IAgentContext, IIdentifier, IKey, IKeyManager, IService } from '@veramo/core'
import { AbstractIdentifierProvider } from '@veramo/did-manager'
import axios from 'axios'

import Debug from 'debug'
import { ICreateIdentifierArgs } from './types'

const debug = Debug('sphereon:oyd-did:identifier-provider')

type IContext = IAgentContext<IKeyManager>

/**
 * {@link @veramo/did-manager#DIDManager} identifier provider for `did:oyd` identifiers
 * @public
 */
export class OydDIDProvider extends AbstractIdentifierProvider {

    constructor(options: { defaultKms: string }) {
        super()
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

        const body = { args, context };
        const url = "https://oydid-registrar.data-container.net/1.0/createIdentifier";
        const result = await axios.post(url, body);
        /* expected return
        {
            "did":"did:oyd:...",
            "controllerKeyId":"...",
            "keys":[{"kid": "string", "kms": "Key Management System string", "type": "ed25519", "publicKeyHex": "string", "privateKeyHex": "string"}],
            "services": [{"id":"string", "type":"string", "serviceEndpoint":"string or Object", "description": "string"}]
        }
        */
        debug('Created', result.data.did as string);
        return result.data as Omit<IIdentifier, 'provider'>;
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

        const body = { args, context };
        const url = "https://oydid-registrar.data-container.net/1.0/updateIdentifier";
        const result = await axios.post(url, body);
        /* expected return
        {
            "did":"did:oyd:...",
            "provider":"string",
            "controllerKeyId":"...",
            "keys":[{"kid": "string", "kms": "Key Management System string", "type": "ed25519", "publicKeyHex": "string", "privateKeyHex": "string"}],
            "services": [{"id":"string", "type":"string", "serviceEndpoint":"string or Object", "description": "string"}]
        }
        */
        debug('Update', result.data.did as string);
        return result.data as IIdentifier;
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

        const body = { identifier, context };
        const url = "https://oydid-registrar.data-container.net/1.0/deactivateIdentifier";
        const result = await axios.post(url, body);
        /* expected return
        {
            "did":"did:oyd:...",
            "success":boolen
        }
        */
        debug('Delete', result.data.did as string);
        return result.data.success as boolean;
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
