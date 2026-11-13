'use client';
import { readApiResponse } from '@/lib/api-response';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { googleReviewUrl } from '@/lib/validation';
import { copyAndContinue } from '@/lib/copy-continue';
type Data = {
  businessName: string;
  category: string;
  logo: string;
  coverImage: string;
  description: string;
  welcomeMessage: string;
  brandColor: string;
  googleReviewUrl: string;
  aspects: string[];
};
export default function ReviewPage() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(''),
    [aspects, setAspects] = useState<string[]>([]),
    [sentiment, setSentiment] = useState('neutral'),
    [notes, setNotes] = useState(''),
    [suggestions, setSuggestions] = useState<string[]>([]),
    [draft, setDraft] = useState(''),
    [busy, setBusy] = useState(false),
    [fallback, setFallback] = useState(false),
    [status, setStatus] = useState('');
  const variation = useRef(0),
    visit = useRef(''),
    textarea = useRef<HTMLTextAreaElement>(null);
  const event = (type: string, id = crypto.randomUUID()) => {
    void fetch('/api/public/stand/' + encodeURIComponent(code) + '/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, eventId: id }),
      keepalive: true,
    }).catch(() => {});
  };
  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/stand/' + encodeURIComponent(code))
      .then(async (r) => {
        const j = await readApiResponse<Data>(r, 'public');
        if (!cancelled) {
          setData(j);
          if (!visit.current) {
            visit.current = crypto.randomUUID();
            event('PAGE_VIEW', visit.current);
          }
        }
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [code]);
  async function generate() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/public/stand/' + code + '/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aspects,
          sentiment,
          notes,
          variation: variation.current,
          eventId: crypto.randomUUID(),
        }),
      });
      const j = await readApiResponse(r, 'public');
      setSuggestions(j.suggestions);
      setDraft(j.suggestions[0]);
      variation.current++;
      setFallback(false);
      setStatus('Choose a draft and make it your own.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function proceed() {
    if (!data) return;
    setBusy(true);
    setError('');
    try {
      await copyAndContinue(draft, data.googleReviewUrl, {
        copy: (t) => navigator.clipboard.writeText(t),
        validate: googleReviewUrl,
        event,
        copied: () => {
          setStatus('Copied. Paste your review on Google.');
          setFallback(true);
        },
        navigate: (u) => window.location.assign(u),
      });
    } catch {
      setFallback(true);
      setError(
        'Could not copy or open Google. Your text is still here. Select it and copy manually, or continue without copying.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      className="review-shell"
      style={{ '--brand': data?.brandColor || '#10b981' } as React.CSSProperties}
    >
      {data?.coverImage && <img className="cover" src={data.coverImage} alt="" />}
      <section className="review-card">
        <p className="eyebrow">ARVIK SMART REVIEWS</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {!data && !error && <div className="skeleton">Loading your business…</div>}
        {data && (
          <>
            {data.logo && (
              <img className="logo" src={data.logo} alt={data.businessName + ' logo'} />
            )}
            <p className="muted">{data.category}</p>
            <h1>{data.businessName}</h1>
            <h2>{data.welcomeMessage || 'We’d love to hear about your experience.'}</h2>
            <p className="muted">{data.description}</p>
            <p>
              Share your genuine experience. Positive, neutral and critical feedback are equally
              welcome.
            </p>
            <fieldset>
              <legend>What would you like to describe?</legend>
              <div className="chips">
                {data.aspects.map((a) => (
                  <button
                    type="button"
                    key={a}
                    aria-pressed={aspects.includes(a)}
                    onClick={() =>
                      setAspects((v) => (v.includes(a) ? v.filter((x) => x !== a) : [...v, a]))
                    }
                  >
                    {a}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              How was your experience?
              <select value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral / mixed</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label>
              Your own words (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1500}
                rows={3}
                placeholder="Describe only what you personally experienced."
              />
            </label>
            <button disabled={busy || (!aspects.length && !notes.trim())} onClick={generate}>
              {busy
                ? 'Working…'
                : suggestions.length
                  ? 'Regenerate suggestions'
                  : 'Generate three suggestions'}
            </button>
            <div className="suggestions">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="suggestion"
                  onClick={() => {
                    setDraft(s);
                    setFallback(false);
                    setStatus('');
                  }}
                >
                  <strong>{['Short', 'Medium', 'Detailed'][i]}</strong>
                  <p>{s}</p>
                </button>
              ))}
            </div>
            <label>
              Your review — freely editable
              <textarea
                ref={textarea}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setStatus('');
                }}
                maxLength={3000}
                rows={6}
                placeholder="Choose a suggestion or write your own review."
              />
            </label>
            <button className="primary full" disabled={busy || !draft.trim()} onClick={proceed}>
              Copy &amp; Continue to Google
            </button>
            <p className="muted small">
              Your review will be copied. Paste it on Google, choose your rating, and submit.
            </p>
            <p role="status">{status}</p>
            {fallback && (
              <div className="panel">
                <button
                  onClick={() => {
                    textarea.current?.focus();
                    textarea.current?.select();
                  }}
                >
                  Select text for manual copy
                </button>
                <a
                  className="button"
                  href={data.googleReviewUrl}
                  onClick={() => event('GOOGLE_LINK_CLICK')}
                >
                  Open Google Reviews
                </a>
              </div>
            )}
            <p className="muted small">
              You choose whether to submit. Google does not automatically receive or prefill this
              text. We record anonymous interaction counts, not your review text, name or contact
              details. No rewards depend on reviews.
            </p>
          </>
        )}
      </section>
      <footer>Powered by Arvik Digital</footer>
    </main>
  );
}
