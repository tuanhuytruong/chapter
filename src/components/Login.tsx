import { FormEvent, useState } from "react";
import { BookMarked, Loader2 } from "lucide-react";
import { useAuth } from "../AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
    } catch {
      setError("Invalid username or password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-natural-bg flex items-center justify-center p-4 font-sans">
      <form onSubmit={submit} className="w-full max-w-sm bg-natural-cream border border-natural-border rounded-[28px] p-7 shadow-sm space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto w-10 h-10 bg-natural-sage rounded-full text-white flex items-center justify-center"><BookMarked className="w-5 h-5" /></div>
          <h1 className="font-bold text-xl text-natural-dark">Welcome to Chapter</h1>
          <p className="text-xs text-natural-stone">Sign in to your reading shelf.</p>
        </div>
        <label className="block text-xs font-bold text-natural-dark">Username<input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your username" className="mt-1.5 w-full rounded-xl border border-natural-border bg-natural-bg px-3 py-2.5 text-natural-dark placeholder:text-natural-stone/70 outline-none transition focus:border-natural-sage focus:ring-2 focus:ring-natural-sage/35 dark:bg-natural-cream/15 dark:[color-scheme:dark]" /></label>
        <label className="block text-xs font-bold text-natural-dark">Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" className="mt-1.5 w-full rounded-xl border border-natural-border bg-natural-bg px-3 py-2.5 text-natural-dark placeholder:text-natural-stone/70 outline-none transition focus:border-natural-sage focus:ring-2 focus:ring-natural-sage/35 dark:bg-natural-cream/15 dark:[color-scheme:dark]" /></label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button disabled={submitting} className="w-full rounded-full bg-natural-sage py-2.5 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-60">{submitting ? <Loader2 className="mx-auto w-4 h-4 animate-spin" /> : "Sign in"}</button>
      </form>
    </main>
  );
}
