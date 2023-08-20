import { resolveDidOyd } from '../index';
import * as fs from 'fs';

fdescribe('@ownyourdata/oyd-did-resolver', () => {
  it('should resolve did:oyd', async () => {
    const doc = await resolveDidOyd(
      'did:oyd:zQmaBZTghndXTgxNwfbdpVLWdFf6faYE4oeuN2zzXdQt1kh');
    expect(doc.didDocument).toEqual(JSON.parse(fs.readFileSync(`${__dirname}/fixtures/did_oyd.jsonld`, { encoding: 'utf-8' })));
  });
});
