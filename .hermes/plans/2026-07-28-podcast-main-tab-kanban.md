# Podcast Main Tab & Story Thread Repair — Kanban

| ID | Task | Status | Verify |
|---|---|---|---|
| P1 | Trace / repair Story Thread schema drift | 🔄 | Regression test + safe SQL handoff |
| P2 | Build EPUB chapter catalog + chapter create API | ⬜ | Route tests with chapter dedupe |
| P3 | Dedicated Podcast main tab | ⬜ | Build + source/UI smoke |
| P4 | Quality gates | ⬜ | verifiers, lint, build, diff |
| P5 | Commit/push dev | ⬜ | Remote ref updated |

## Checklist
- [ ] Reproduce root cause without guessing
- [ ] Implement idempotent schema repair
- [ ] Make chapter key the only episode selection identity
- [ ] Re-index legacy EPUB units when possible
- [ ] Move Podcasts out of Book Detail
- [ ] Verify backend privacy/range contracts
- [ ] Browser-review available authenticated UI
- [ ] Push validated dev commit
