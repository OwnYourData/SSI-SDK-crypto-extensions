// @ts-ignore
import * as oydid from 'oydid-did-resolver';
import { DIDResolutionResult, DIDResolver, DIDResolutionOptions, ResolverRegistry } from 'did-resolver'
export * from './types'

export const resolveDidOyd: DIDResolver = async (did: string, options?: DIDResolutionOptions): Promise<DIDResolutionResult> => {
    return oydid.getResolver().resolve(did, undefined, undefined, options)
}

const getResolver = (): ResolverRegistry => {
    return oydid.getResolver()
}
export { getResolver }
