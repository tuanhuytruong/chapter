interface ContentSkeletonProps {
  className?: string;
  animated?: boolean;
}

export function ContentSkeleton({ className = "", animated = true }: ContentSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`${animated ? "animate-pulse motion-reduce:animate-none" : ""} rounded-2xl bg-natural-border/65 ${className}`}
    />
  );
}

export function BookDetailSkeleton() {
  return (
    <div className="space-y-6 font-sans" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading book details</span>
      <div className="flex items-center justify-between">
        <ContentSkeleton animated={false} className="h-5 w-20" />
        <ContentSkeleton animated={false} className="h-9 w-24" />
      </div>
      <section className="rounded-[28px] border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <ContentSkeleton animated={false} className="aspect-[2/3] w-28 shrink-0 sm:w-36" />
          <div className="min-w-0 flex-1 space-y-4">
            <ContentSkeleton animated={false} className="h-4 w-24" />
            <ContentSkeleton animated={false} className="h-9 w-4/5 max-w-md" />
            <ContentSkeleton animated={false} className="h-4 w-1/2 max-w-xs" />
            <ContentSkeleton animated={false} className="h-2.5 w-full rounded-full" />
            <div className="flex flex-wrap gap-2 pt-2">
              <ContentSkeleton animated={false} className="h-11 w-40 rounded-full" />
              <ContentSkeleton animated={false} className="h-11 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </section>
      <section className="space-y-3" aria-hidden="true">
        <ContentSkeleton animated={false} className="h-6 w-40" />
        {[0, 1].map((index) => (
          <div key={index} className="rounded-[24px] border border-natural-border bg-natural-cream p-5">
            <ContentSkeleton animated={false} className="h-4 w-28" />
            <ContentSkeleton animated={false} className="mt-4 h-4 w-full" />
            <ContentSkeleton animated={false} className="mt-2 h-4 w-4/5" />
          </div>
        ))}
      </section>
    </div>
  );
}

export function PricingSkeleton() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 pb-8 sm:space-y-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading membership options</span>
      <ContentSkeleton className="h-5 w-20" />
      <section className="rounded-[2rem] border border-natural-sage/20 bg-natural-sage/10 px-5 py-8 sm:px-9 sm:py-12" aria-hidden="true">
        <ContentSkeleton className="h-4 w-28" />
        <ContentSkeleton className="mt-4 h-11 w-4/5 max-w-2xl" />
        <ContentSkeleton className="mt-3 h-11 w-3/5 max-w-xl" />
        <ContentSkeleton className="mt-6 h-11 w-44 rounded-full" />
      </section>
      <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]" aria-hidden="true">
        <div className="space-y-5 rounded-3xl border border-natural-sage/30 bg-natural-sage/10 p-5 sm:p-7">
          <ContentSkeleton className="h-8 w-48" />
          <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((index) => <div key={index}>
   <ContentSkeleton className="h-32" />
 </div>)}</div>
        </div>
        <div className="space-y-3 rounded-3xl border border-natural-border bg-natural-cream p-5 sm:p-7">
          <ContentSkeleton className="h-5 w-28" />
          <ContentSkeleton className="h-24 w-full" />
          <ContentSkeleton className="h-24 w-full" />
        </div>
      </section>
    </main>
  );
}
