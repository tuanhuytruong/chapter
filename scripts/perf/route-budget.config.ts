export type RouteBudget = {
  id: string;
  manifestKey: string;
  label: string;
  initialGzipBudget: number;
};

export const routeBudgets: RouteBudget[] = [
  { id: "auth", manifestKey: "index.html", label: "Public auth bootstrap", initialGzipBudget: 160_000 },
  { id: "library", manifestKey: "src/pages/Library.tsx", label: "Library", initialGzipBudget: 220_000 },
  { id: "today", manifestKey: "src/pages/Today.tsx", label: "Today", initialGzipBudget: 220_000 },
  { id: "book-detail", manifestKey: "src/pages/BookDetail.tsx", label: "Book Detail", initialGzipBudget: 300_000 },
];

export const largestLazyChunkGzipBudget = 100_000;
// Transitional all-app guard, measured with the production analytics environment.
// Route and lazy-chunk gzip budgets remain the load-performance gates; this only
// catches material all-app regressions across optional routes.
export const totalJavaScriptRawBudget = 980_000;
export const routeGrowthWarningGzip = 5_000;
export const lazyChunkGrowthWarningGzip = 15_000;
