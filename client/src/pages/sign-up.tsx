import { useSignUp } from "@clerk/react/legacy";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isNittEmail } from "@/lib/nitt-auth";

export default function SignUpPage() {
  const { isLoaded: isSignUpLoaded, signUp, setActive } = useSignUp();
  const [, setLocation] = useLocation();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const otpSlots = Array.from({ length: 6 }, (_, index) => code[index] || "");

  const canSubmit = useMemo(() => !isSubmitting, [isSubmitting]);

  useEffect(() => {
    if (!isSignUpLoaded || !signUp) {
      setErrorMessage("Auth is still loading. Please try again in a moment.");
      return;
    }

    const emailFromSignup = signUp.emailAddress || "";
    const emailVerification = signUp.verifications?.emailAddress?.status;

    if (emailFromSignup && emailAddress.trim().length === 0) {
      setEmailAddress(emailFromSignup);
    }

    if (emailVerification === "pending") {
      setPendingVerification(true);
    }
  }, [isSignUpLoaded, signUp, emailAddress]);

  const handleStartSignUp = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setEmailError(null);

    if (!isSignUpLoaded || !signUp) {
      return;
    }

    if (emailAddress.trim().length === 0) {
      setEmailError("Enter your NITT webmail.");
      return;
    }

    if (!isNittEmail(emailAddress)) {
      setEmailError("Enter your NITT webmail.");
      return;
    }

    if (password.length === 0) {
      setErrorMessage("Create a password to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signUp.create({
        emailAddress: emailAddress.trim(),
        password,
      });

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setPendingVerification(true);
    } catch (error: any) {
      const message =
        error?.errors?.[0]?.message ||
        error?.message ||
        "Unable to start sign up. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setEmailError(null);

    if (!isSignUpLoaded || !signUp) {
      return;
    }

    if (!isNittEmail(emailAddress)) {
      setEmailError("Enter your NITT webmail.");
      setPendingVerification(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result?.status === "complete") {
        const sessionId = result.createdSessionId || signUp.createdSessionId;
        if (!sessionId) {
          setErrorMessage("Unable to start your session. Please try again.");
          return;
        }

        await setActive?.({ session: sessionId });
        if (typeof window !== "undefined") {
          window.location.assign("/projects");
          return;
        }

        setLocation("/projects", { replace: true });
        return;
      }

      setErrorMessage("Verification is incomplete. Please try again.");
    } catch (error: any) {
      const message =
        error?.errors?.[0]?.message ||
        error?.message ||
        "Verification failed. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const otpBoxClassName = (index: number) => {
    const isActive = index === Math.min(code.length, otpSlots.length - 1);
    const isFilled = !!otpSlots[index];

    return [
      "flex h-14 items-center justify-center rounded-xl border text-xl font-mono font-bold transition-all",
      isFilled
        ? "border-pink-300 bg-pink-300/10 text-pink-100 shadow-[0_0_18px_rgba(244,114,182,0.2)]"
        : "border-pink-400/35 bg-black/50 text-pink-200/35",
      !isFilled && isActive ? "border-cyan-300/70 shadow-[0_0_18px_rgba(103,232,249,0.18)]" : "",
    ].join(" ");
  };

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
          <div className="inline-flex items-center gap-3 border border-pink-400/60 bg-black/50 px-4 py-2 font-mono text-xs uppercase tracking-[0.4em] text-pink-200">
            ACCOUNT ACCESS
          </div>
          <h1 className="text-4xl md:text-5xl font-mono tracking-widest text-pink-200 drop-shadow-[0_0_20px_rgba(255,0,200,0.6)]">
            SIGN UP
          </h1>
          <p className="text-sm text-pink-100/70 font-mono">
            Create your account to join the Product Folks grid.
          </p>
          <div className="flex flex-wrap gap-4 text-xs font-mono uppercase tracking-[0.35em] text-pink-200/70">
            <Link href="/sign-in" className="hover:text-pink-200">
              ALREADY REGISTERED?
            </Link>
            <Link href="/auth" className="hover:text-pink-200">
              BACK TO AUTH HUB
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-pink-400/40 bg-black/60 p-6 shadow-[0_0_40px_rgba(255,0,200,0.12)] backdrop-blur-xl">
          {!pendingVerification && (
            <form className="space-y-4" onSubmit={handleStartSignUp}>
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-[0.35em] text-pink-200/70">
                  NITT Webmail
                </label>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="rollnumber@nitt.edu"
                  value={emailAddress}
                  className="border-pink-400/50 bg-black/70 text-pink-100 placeholder:text-pink-200/35 focus-visible:ring-pink-300 focus-visible:ring-offset-0"
                  onChange={(event) => {
                    setEmailAddress(event.target.value);
                    if (emailError) {
                      setEmailError(null);
                    }
                  }}
                />
                {emailError ? (
                  <p className="text-xs font-mono text-red-400">
                    {emailError}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-[0.35em] text-pink-200/70">
                  Password
                </label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  value={password}
                  className="border-pink-400/50 bg-black/70 text-pink-100 placeholder:text-pink-200/35 focus-visible:ring-pink-300 focus-visible:ring-offset-0"
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {errorMessage ? (
                <p className="text-xs font-mono text-red-400">{errorMessage}</p>
              ) : null}
              <Button
                type="submit"
                className="w-full bg-pink-400 text-black hover:bg-pink-300"
                disabled={!canSubmit}
              >
                {isSubmitting ? "SENDING OTP..." : "SEND OTP"}
              </Button>
            </form>
          )}

          {pendingVerification && (
            <form className="space-y-4" onSubmit={handleVerifyCode}>
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-[0.35em] text-pink-200/70">
                  Verification Code
                </label>
                <div className="space-y-3">
                  <div className="relative">
                    <div className="grid grid-cols-6 gap-2">
                      {otpSlots.map((digit, index) => (
                        <div key={index} className={otpBoxClassName(index)}>
                          {digit}
                        </div>
                      ))}
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-label="Verification code"
                      maxLength={6}
                      value={code}
                      onChange={(event) =>
                        setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      className="absolute inset-0 h-full w-full cursor-text opacity-0"
                    />
                  </div>
                  <p className="text-xs font-mono text-pink-200/60">
                    Enter the 6-digit OTP sent to {emailAddress || "your NITT webmail"}.
                  </p>
                </div>
              </div>
              {errorMessage ? (
                <p className="text-xs font-mono text-red-400">{errorMessage}</p>
              ) : null}
              <Button
                type="submit"
                className="w-full bg-pink-400 text-black hover:bg-pink-300"
                disabled={code.trim().length === 0 || isSubmitting}
              >
                {isSubmitting ? "VERIFYING..." : "VERIFY OTP"}
              </Button>
              <button
                type="button"
                className="w-full text-xs font-mono uppercase tracking-[0.35em] text-pink-200/70 hover:text-pink-200"
                onClick={() => setPendingVerification(false)}
              >
                Change Email
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
