import { audiobookChapterStaticParams } from './static-params';

it('exports all 18 concrete chapters without duplicates or language-dependent routes', () => {
  const params = audiobookChapterStaticParams();
  expect(params).toHaveLength(18);
  expect(new Set(params.map(p => `${p.track}/${p.chapter}`)).size).toBe(18);
  expect(params.filter(p => p.track === 'pflichtwissen')).toHaveLength(8);
  expect(params.filter(p => p.track === 'grammatik-hoerbuch')).toHaveLength(10);
});
