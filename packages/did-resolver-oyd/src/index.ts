// @ts-ignore
import * as oydid from 'oydid-did-resolver';
import { DIDResolutionResult, DIDResolutionOptions, ResolverRegistry } from 'did-resolver';
export * from './types'

const resolveDidOyd = async (did: string, options?: DIDResolutionOptions): Promise<DIDResolutionResult> => {
    return oydid.getResolver().oyd(did, undefined, undefined, options)
}

const getResolver = (): ResolverRegistry => {
    return oydid.getResolver()
}
export { getResolver, resolveDidOyd }
