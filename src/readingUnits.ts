import type { BookRow } from './types';

export function readingUnit(fileType: BookRow['file_type'], count = 2): string {
  const singular = fileType === 'epub' ? 'reading chunk' : 'page';
  return count === 1 ? singular : `${singular}s`;
}

export function readingRange(fileType: BookRow['file_type'], start: number, end: number): string {
  return `${readingUnit(fileType, end - start + 1)} ${start}–${end}`;
}

export function dailyTargetLabel(fileType: BookRow['file_type']): string {
  return fileType === 'epub' ? 'Chunks/day' : 'Pages/day';
}

export function progressShortLabel(book: BookRow): string {
  return `${book.current_page}/${book.total_pages} ${book.file_type === 'epub' ? 'chunks' : 'pg'}`;
}
