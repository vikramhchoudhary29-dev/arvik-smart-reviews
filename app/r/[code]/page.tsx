'use client';
import { readApiResponse } from '@/lib/api-response';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { googleReviewUrl } from '@/lib/validation';
import { copyAndContinue } from '@/lib/copy-continue';
type Data = {
  businessName: string;
  location: string;
  experiencePrompt: string;
  staffEnabled: boolean;
  staffQuestion: string;
  staff: { id: string; name: string; role: string }[];
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
    [staffId, setStaffId] = useState(''),
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
          ...(staffId ? { staffId } : {}),
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
  const brand = data?.brandColor || '#059669';
  const rgb = [1, 3, 5]
    .map((i) => parseInt(brand.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const ink = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179 ? '#111827' : '#ffffff';
  return (
    <main
      className="customer-page"
      style={{ '--brand': brand, '--brand-ink': ink } as React.CSSProperties}
    >
      <div className="customer-container">
        {!data && (
          <section className="customer-card">
            {error ? (
              <p role="alert" className="error">
                {error}
              </p>
            ) : (
              <div className="customer-loading" role="status">
                Loading your business…
                <div />
                <div />
                <div />
              </div>
            )}
          </section>
        )}
        {data && (
          <>
            <header className="customer-brand">
              {data.coverImage && <img className="customer-cover" src={data.coverImage} alt="" />}
              <div className="customer-identity">
                {data.logo ? (
                  <img
                    className="customer-logo"
                    src={data.logo}
                    alt={data.businessName + ' logo'}
                  />
                ) : (
                  <div className="customer-monogram" aria-hidden="true">
                    {data.businessName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="customer-kicker">
                    {data.category.replaceAll('_', ' ')}
                    {data.location ? ' · ' + data.location : ''}
                  </p>
                  <h1>{data.businessName}</h1>
                </div>
              </div>
              <h2>
                {data.welcomeMessage || data.experiencePrompt || 'Tell us about your experience.'}
              </h2>
              {data.description && <p className="customer-description">{data.description}</p>}
              <p className="customer-trust">
                Your honest feedback matters. Positive, neutral and critical experiences are equally
                welcome.
              </p>
            </header>
            <ol className="customer-progress" aria-label="Your feedback journey">
              <li>
                <span>1</span>Your experience
              </li>
              <li>
                <span>2</span>Make it personal
              </li>
              <li>
                <span>3</span>Share on Google
              </li>
            </ol>
            <section className="customer-card" aria-label="Experience details">
              <p className="customer-step">STEP 01</p>
              <h2 id="experience-heading">{data.experiencePrompt || 'How was your experience?'}</h2>
              <label>
                How was your experience?
                <select value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral / mixed</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
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
            </section>
            <section className="customer-card" aria-labelledby="personal-heading">
              <p className="customer-step">STEP 02</p>
              <h2 id="personal-heading">Make it personal.</h2>
              {data.staffEnabled && data.staff?.length > 0 && (
                <label>
                  {data.staffQuestion} (optional)
                  <select
                    value={staffId}
                    onChange={(e) => {
                      setStaffId(e.target.value);
                      if (draft)
                        setStatus(
                          'Staff selection changed. Generate again or edit your draft to update the mention.',
                        );
                    }}
                  >
                    <option value="">Skip / not sure</option>
                    {data.staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                        {member.role ? ' · ' + member.role : ''}
                      </option>
                    ))}
                  </select>
                  <span className="customer-hint">
                    Only select someone you personally interacted with.
                  </span>
                </label>
              )}
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
              <button
                className="customer-generate"
                disabled={busy || (!aspects.length && !notes.trim())}
                onClick={generate}
              >
                {busy
                  ? 'Working…'
                  : suggestions.length
                    ? 'Regenerate suggestions'
                    : 'Generate three suggestions'}
              </button>
              <p className="customer-hint">
                Suggestions are optional. You can write your own review below.
              </p>
            </section>
            <section className="customer-card" aria-labelledby="draft-heading">
              <p className="customer-step">STEP 03</p>
              <h2 id="draft-heading">Your words. Your choice.</h2>
              <p className="customer-description">
                Choose a starting point, edit freely and share only what reflects your visit.
              </p>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <div className="suggestions">
                {suggestions.map((s, i) => (
                  <button
                    type="button"
                    key={i}
                    className="suggestion"
                    aria-pressed={draft === s}
                    onClick={() => {
                      setDraft(s);
                      setFallback(false);
                      setStatus('');
                    }}
                  >
                    <strong>{['Short', 'Medium', 'Detailed'][i]}</strong>
                    <p>{s}</p>
                    <span className="customer-hint">
                      {draft === s ? 'Selected draft' : 'Use this draft'}
                    </span>
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
              <p className="customer-hint">
                Paste your text on Google, choose your star rating and decide whether to publish.
                Google may ask you to sign in.
              </p>
              <p role="status" aria-live="polite">
                {status}
              </p>
              {fallback && (
                <div className="customer-fallback">
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
              <p className="customer-privacy">
                You choose whether to submit. No automatic posting or prefilled Google text. We
                record interaction counts and optional staff-selection counts, not your review text
                or personal contact details. No rewards depend on reviews.
              </p>
            </section>
          </>
        )}
        <footer className="customer-footer">
          Powered by{' '}
          <a
            href="https://www.arvikdigital.in/smart-reviews"
            target="_blank"
            rel="noopener noreferrer"
          >
            Arvik Smart Reviews
          </a>
          <span>Thoughtful feedback. In your own words.</span>
        </footer>
      </div>
    </main>
  );
}
