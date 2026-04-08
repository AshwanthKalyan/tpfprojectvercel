import { SignIn } from "@clerk/react";
import { Link } from "wouter";
import { authClerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,200,0.12) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
      <div className="absolute -top-40 -left-32 h-[420px] w-[420px] rounded-full bg-cyan-500/30 blur-[140px]" />
      <div className="absolute -bottom-40 -right-32 h-[420px] w-[420px] rounded-full bg-pink-500/30 blur-[140px]" />

      <div className="relative z-10 mx-auto grid w-full max-w-5xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-3 border border-cyan-400/60 bg-black/50 px-4 py-2 font-mono text-xs uppercase tracking-[0.4em] text-cyan-200">
            ACCOUNT ACCESS
          </div>
          <h1 className="text-4xl md:text-5xl font-mono tracking-widest text-cyan-200 drop-shadow-[0_0_20px_rgba(0,255,255,0.6)]">
            SIGN IN
          </h1>
          <p className="text-sm text-cyan-100/70 font-mono">
            Sign in with your email to access the Product Folks grid.
          </p>
          <div className="flex flex-wrap gap-4 text-xs font-mono uppercase tracking-[0.35em] text-cyan-200/70">
            <Link href="/sign-up" className="hover:text-cyan-200">
              NEED AN ACCOUNT?
            </Link>
            <Link href="/auth" className="hover:text-cyan-200">
              BACK TO AUTH HUB
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-400/40 bg-black/60 p-6 shadow-[0_0_40px_rgba(0,255,255,0.1)] backdrop-blur-xl">
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            afterSignInUrl="/projects"
            appearance={authClerkAppearance}
          />
        </div>
      </div>
    </main>
  );
}
