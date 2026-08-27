# Chapter product analytics event taxonomy

PostHog events use metadata only. Never send titles, authors, filenames, reading text, intentions, notes, transcripts, email, URLs, credentials, or backend error bodies.

- Activation: `sign_up_completed` -> `book_added` -> `reading_session_completed` -> `book_wiki_opened`.
- Upload: `book_add_started` -> `book_upload_started` -> `book_upload_completed` -> `book_added`.
- Listening: `podcast_episode_played` -> `podcast_episode_completed`.
- Habit: weekly retention on `reading_session_completed`.

Batch 2: `book_add_started`, `book_upload_started`, `book_upload_completed`, `book_upload_failed`, `reading_session_failed`, `podcast_episode_played`, `podcast_episode_completed`, `review_completed`, `weekly_goal_set`.
