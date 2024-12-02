/**
 * Azure KeyVault REST API
 * REST API for interacting with Azure Key Vault
 *
 * OpenAPI spec version: v1
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { BinaryData } from '../models/BinaryData';
import { HttpFile } from '../http/http';

export class KeyReleasePolicy {
    'encodedPolicy'?: BinaryData;
    'contentType'?: string;
    'immutable'?: boolean;

    static readonly discriminator: string | undefined = undefined;

    static readonly mapping: {[index: string]: string} | undefined = undefined;

    static readonly attributeTypeMap: Array<{name: string, baseName: string, type: string, format: string}> = [
        {
            "name": "encodedPolicy",
            "baseName": "encodedPolicy",
            "type": "BinaryData",
            "format": ""
        },
        {
            "name": "contentType",
            "baseName": "contentType",
            "type": "string",
            "format": ""
        },
        {
            "name": "immutable",
            "baseName": "immutable",
            "type": "boolean",
            "format": ""
        }    ];

    static getAttributeTypeMap() {
        return KeyReleasePolicy.attributeTypeMap;
    }

    public constructor() {
    }
}
