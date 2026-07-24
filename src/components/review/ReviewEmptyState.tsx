import { Link } from 'react-router-dom';

export default function ReviewEmptyState({ done }: { done: number }) {
  return (
    <section className="rounded-[24px] border border-natural-border bg-natural-cream px-6 py-10 text-center shadow-sm sm:px-10 sm:py-12">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-natural-sage">Quiet recall</p>
      <h2 className="mt-2 text-lg font-bold text-natural-dark">Nothing due today</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-natural-stone">Your next idea will return when a little distance can make it easier to remember.</p>
      {done > 0 && <p className="mt-4 text-xs font-semibold text-natural-sage">{done} idea{done === 1 ? '' : 's'} revisited today.</p>}
      <Link to="/" className="mt-6 inline-flex min-h-11 items-center rounded-full border border-natural-border px-5 text-xs font-bold uppercase tracking-wider text-natural-dark hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage">Continue reading</Link>
    </section>
  );
}
