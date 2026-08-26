-- Optional, owner-private motivation for a book; existing books remain unchanged.
ALTER TABLE chapter.books
  ADD COLUMN IF NOT EXISTS reading_intention TEXT;
