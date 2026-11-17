import Link from 'next/link';
export default function Home() {
  return (
    <main className="review-shell">
      <section className="review-card">
        <p className="eyebrow">ARVIK DIGITAL</p>
        <h1>Smart Reviews</h1>
        <p>Thoughtful feedback starts with a genuine experience.</p>
        <p className="muted">
          Tap or scan a business stand to share your experience. Businesses and stands are centrally
          managed by Arvik Digital with yearly business subscriptions.
        </p>
        <Link className="button" href="/admin/login">
          Administrator sign in
        </Link>
        <p>
          <Link className="button" href="/owner/login">
            Business Owner sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
