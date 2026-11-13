import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readApiResponse, ApiResponseError } from '../lib/api-response';
test('API reader accepts successful JSON objects and preserves actionable validation messages', async () => {
  assert.deepEqual(await readApiResponse(Response.json({ settings: { retentionDays: 90 } })), {
    settings: { retentionDays: 90 },
  });
  await assert.rejects(
    readApiResponse(Response.json({ error: 'Slug already exists' }, { status: 409 })),
    { name: 'ApiResponseError', message: 'Slug already exists', status: 409 },
  );
});
test('empty and HTML server failures produce safe errors rather than JSON parser exceptions', async () => {
  for (const body of ['', '<!DOCTYPE html><html>private server stack</html>']) {
    await assert.rejects(
      readApiResponse(
        new Response(body, { status: 500, headers: { 'content-type': 'text/html' } }),
      ),
      (e) =>
        e instanceof ApiResponseError &&
        e.status === 500 &&
        !/Unexpected|DOCTYPE|private server stack|JSON/.test(e.message),
    );
    await assert.rejects(
      readApiResponse(
        new Response(body, { status: 500, headers: { 'content-type': 'text/html' } }),
        'public',
      ),
      { message: 'This page is temporarily unavailable. Please try again shortly.' },
    );
  }
});
test('malformed, empty or non-object successful payloads are rejected clearly', async () => {
  for (const body of ['', '{', 'null', '[]', '"text"'])
    await assert.rejects(
      readApiResponse(new Response(body, { headers: { 'content-type': 'application/json' } })),
      ApiResponseError,
    );
  await assert.rejects(
    readApiResponse(new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })),
    ApiResponseError,
  );
});
