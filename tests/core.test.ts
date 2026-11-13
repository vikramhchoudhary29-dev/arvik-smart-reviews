import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleReviewUrl, businessSchema, templateSchema } from '../lib/validation';
import { reviewSuggestions } from '../lib/review-suggestions';
import { copyAndContinue } from '../lib/copy-continue';
test('review destinations reject unsafe hosts and generic homepages', () => {
  for (const url of [
    'http://g.page/r/abc/review',
    'https://google.com',
    'https://google.com.evil.com/maps?cid=1',
    'https://user:pass@g.page/r/abc/review',
    'javascript:alert(1)',
    'https://g.page/abc',
    'https://www.google.com/maps?cid=123',
    'https://g.page/r/abc/review#evil',
  ])
    assert.equal(googleReviewUrl(url), false, url);
  for (const url of [
    'https://g.page/r/abc/review',
    'https://search.google.com/local/writereview?placeid=ChIJabc',
    'https://g.page/my-business/review',
  ])
    assert.equal(googleReviewUrl(url), true, url);
});
test('schemas reject unknown fields, unsafe media, malformed templates', () => {
  assert.equal(
    businessSchema.safeParse({
      name: 'Test',
      slug: 'test',
      googleReviewUrl: 'https://g.page/r/abc/review',
      logo: 'https://evil.com/a.png',
    }).success,
    false,
  );
  assert.equal(
    templateSchema.safeParse({
      category: 'general',
      sentiment: 'neutral',
      tag: '*',
      text: 'Invented excellent visit',
    }).success,
    false,
  );
});
test('drafts use only supplied aspects, sentiment and words; varied and editable', () => {
  const phrases = [
    { tag: '*', sentiment: 'critical', text: 'The {aspect} needs improvement.' },
    { tag: '*', sentiment: 'critical', text: 'I was disappointed with the {aspect}.' },
  ];
  const a = reviewSuggestions(['Service', 'Pricing'], 'critical', 'My own detail.', phrases, 0),
    b = reviewSuggestions(['Service', 'Pricing'], 'critical', 'My own detail.', phrases, 1);
  assert.equal(a.length, 3);
  assert.equal(new Set(a).size, 3);
  assert.ok(a[2].includes('My own detail.'));
  assert.ok(a.every((s) => !s.includes('helpful')));
  assert.notDeepEqual(a, b);
  assert.throws(() => reviewSuggestions(['Service'], 'positive', '', phrases, 0));
});
test('copy success confirms, records and navigates in order; analytics exceptions do not block', async () => {
  const steps: string[] = [];
  await copyAndContinue('My words', 'https://g.page/r/abc/review', {
    copy: async (t) => {
      assert.equal(t, 'My words');
      steps.push('copy');
    },
    copied: () => steps.push('confirmed'),
    event: (t) => steps.push(t),
    navigate: () => steps.push('navigate'),
    validate: googleReviewUrl,
  });
  assert.deepEqual(steps, [
    'copy',
    'confirmed',
    'COPY_SUGGESTION',
    'GOOGLE_LINK_CLICK',
    'navigate',
  ]);
  await copyAndContinue('text', 'https://g.page/r/abc/review', {
    copy: async () => {},
    copied: () => {},
    event: () => {
      throw Error();
    },
    navigate: () => steps.push('survived'),
    validate: googleReviewUrl,
  });
  assert.equal(steps.at(-1), 'survived');
});
test('failed clipboard never records a copy or navigates; empty text rejected', async () => {
  let count = 0;
  const deps = {
    copy: async () => {
      throw Error('denied');
    },
    copied: () => count++,
    event: () => count++,
    navigate: () => count++,
    validate: googleReviewUrl,
  };
  await assert.rejects(copyAndContinue('text', 'https://g.page/r/abc/review', deps));
  await assert.rejects(copyAndContinue(' ', 'https://g.page/r/abc/review', deps));
  assert.equal(count, 0);
});
