import { DID_JSON, DID_LD_JSON, resolveDidOyd } from '../index'
import * as fs from 'fs'

describe('@ownyourdata/oyd-did-resolver', () => {
  it('should resolve did:oyd', async () => {
    const doc = await resolveDidOyd(
      'did:oyd:zQmaBZTghndXTgxNwfbdpVLWdFf6faYE4oeuN2zzXdQt1kh', undefined, undefined, undefined
    )
    expect(doc).toEqual(JSON.parse(fs.readFileSync(`${__dirname}/fixtures/did_oyd.jsonld`, { encoding: 'utf-8' })))
  })
})
