import { useRouter } from "next/router";
import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message);
      setIsLoading(false);
      return;
    }
    const to = router.query.redirectedFrom || "/dashboard";
    router.replace(to);
  };

  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-stone-900 mb-1" style={{ fontFamily: "Georgia, serif" }}>
            MyasNailsBaby
          </h1>
          <p className="text-stone-500 text-sm">Dashboard Login</p>
        </div>

        {/* Form */}
        <div className="bg-white border border-stone-200 p-8">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                className="w-full px-4 py-3 border border-stone-300 focus:border-stone-900 focus:outline-none transition text-stone-900 placeholder-stone-400"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="w-full px-4 py-3 border border-stone-300 focus:border-stone-900 focus:outline-none transition text-stone-900 placeholder-stone-400"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {err && (
              <div className="bg-red-50 border border-red-200 p-3">
                <p className="text-red-700 text-sm">{err}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 font-medium text-sm tracking-wide transition ${
                isLoading ? "bg-stone-300 text-stone-500 cursor-not-allowed" : "bg-rose-800 hover:bg-rose-900 text-white"
              }`}
            >
              {isLoading ? "Signing In..." : "SIGN IN"}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-xs text-stone-400 hover:text-stone-700 transition">
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
