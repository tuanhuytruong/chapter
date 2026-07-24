import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const assertIncludes = (file: string, expected: string) => {
  if (!read(file).includes(expected)) throw new Error(`${file} is missing: ${expected}`);
};

assertIncludes("migrations/20260724_add_onboarding_progress.sql", "CREATE TABLE IF NOT EXISTS chapter.onboarding_progress");
assertIncludes("src/db/schema.sql", "CREATE TABLE IF NOT EXISTS chapter.onboarding_progress");
assertIncludes("src/db.ts", '"onboarding_progress"');
assertIncludes("server.ts", 'app.get("/api/onboarding"');
assertIncludes("server.ts", 'app.patch("/api/onboarding"');
assertIncludes("server.ts", "ONBOARDING_STEPS");
assertIncludes("src/api.ts", "getOnboarding");
assertIncludes("src/api.ts", "saveOnboarding");
assertIncludes("src/onboarding.tsx", "OnboardingProvider");
assertIncludes("src/pages/Library.tsx", 'step="welcome"');
assertIncludes("src/components/AddBookModal.tsx", 'step="add_book"');
assertIncludes("src/pages/BookDetail.tsx", 'step="first_session"');
assertIncludes("src/pages/BookDetail.tsx", 'step="story_thread"');
assertIncludes("src/pages/Review.tsx", 'step="review"');
assertIncludes("src/components/JourneyDrawer.tsx", 'step="journey"');
assertIncludes("src/pages/Account.tsx", "OnboardingHelp");
assertIncludes("src/App.tsx", 'title="Sign out" aria-label="Sign out"');
assertIncludes("src/App.tsx", 'to="/profile" aria-label="Your profile"');
assertIncludes("src/App.tsx", 'to="/account" aria-label="Telegram settings"');
assertIncludes("src/pages/Profile.tsx", "Choose an animal companion");
assertIncludes("server.ts", 'app.patch("/api/auth/profile"');
assertIncludes("server.ts", "isAvatarPresetValue");

console.log("ONBOARDING_FIXTURES_OK");
