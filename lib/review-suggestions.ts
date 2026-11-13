type Phrase = { text: string; tag: string; sentiment: string };
export function reviewSuggestions(
  aspects: string[],
  sentiment: string,
  notes: string,
  phrases: Phrase[],
  variation: number,
) {
  const statements = aspects.map((aspect, i) => {
    const pool = phrases.filter(
      (p) => p.sentiment === sentiment && (p.tag === aspect || p.tag === '*'),
    );
    if (!pool.length)
      throw Error('No active phrases for this experience. Please write your own review.');
    return pool[(variation + i) % pool.length].text.replaceAll('{aspect}', aspect.toLowerCase());
  });
  const own = notes.trim();
  if (!statements.length && !own) throw Error('Select an experience or describe it first.');
  const all = [...statements, ...(own ? [own] : [])];
  return [
    all.slice(0, 1).join(' '),
    all.slice(0, Math.max(1, Math.ceil(all.length / 2))).join(' '),
    all.join(' '),
  ].map((s, i) => (i === 1 ? 'My experience: ' + s : i === 2 ? 'Here is my feedback. ' + s : s));
}
