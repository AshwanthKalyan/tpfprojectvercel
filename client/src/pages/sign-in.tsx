import { useSignIn } from "@clerk/react/legacy";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isNittEmail } from "@/lib/nitt-auth";

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [, setLocation] = useLocation();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationTarget, setVerificationTarget] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => !isSubmitting, [isSubmitting]);
  const otpSlots = Array.from({ length: 6 }, (_, index) => code[index] || "");

  const otpBoxClassName = (index: number) => {
    const isActive = index === Math.min(code.length, otpSlots.length - 1);
    const isFilled = !!otpSlots[index];

    return [
      "flex h-14 items-center justify-center rounded-xl border text-xl font-mono font-bold transition-all",
      isFilled
        ? "border-cyan-300 bg-cyan-300/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.22)]"
        : "border-cyan-400/35 bg-black/50 text-cyan-200/35",
      !isFilled && isActive
        ? "border-pink-300/70 shadow-[0_0_18px_rgba(244,114,182,0.18)]"
        : "",
    ].join(" ");
  };

  const finalizeSignIn = async (sessionId: string | null | undefined) => {
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
  };

  const handleStartSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setEmailError(null);

    if (!isLoaded || !signIn) {
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
      setErrorMessage("Enter your password to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress.trim(),
        password,
      });

      if (signInAttempt.status === "complete") {
        await finalizeSignIn(signInAttempt.createdSessionId);
        return;
      }

      if (signInAttempt.status === "needs_second_factor") {
        const emailCodeFactor = signInAttempt.supportedSecondFactors?.find(
          (factor: any) => factor?.strategy === "email_code"
        ) as { emailAddressId?: string; safeIdentifier?: string } | undefined;

        if (!emailCodeFactor?.emailAddressId) {
          setErrorMessage("This sign-in verification method is not available.");
          return;
        }

        await signIn.prepareSecondFactor({
          strategy: "email_code",
          emailAddressId: emailCodeFactor.emailAddressId,
        });

        setVerificationTarget(
          emailCodeFactor.safeIdentifier || emailAddress.trim()
        );
        setPendingVerification(true);
        return;
      }

      setErrorMessage("Sign-in could not be completed. Please try again.");
    } catch (error: any) {
      const message =
        error?.errors?.[0]?.message ||
        error?.message ||
        "Unable to sign in. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setEmailError(null);

    if (!isLoaded || !signIn) {
      return;
    }

    setIsSubmitting(true);
    try {
      const signInAttempt = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code,
      });

      if (signInAttempt.status === "complete") {
        await finalizeSignIn(signInAttempt.createdSessionId);
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
            {pendingVerification ? "VERIFY DEVICE" : "SIGN IN"}
          </h1>
          <p className="text-sm font-mono text-cyan-100/70">
            {pendingVerification
              ? "A new-device verification code was sent to your NITT webmail."
              : "Sign in with your NITT webmail to access the Product Folks grid."}
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
          {!pendingVerification && (
            <form className="space-y-4" onSubmit={handleStartSignIn}>
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-[0.35em] text-cyan-200/70">
                  NITT Webmail
                </label>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="rollnumber@nitt.edu"
                  value={emailAddress}
                  className="border-cyan-400/50 bg-black/70 text-cyan-100 placeholder:text-cyan-200/35 focus-visible:ring-cyan-300 focus-visible:ring-offset-0"
                  onChange={(event) => {
                    setEmailAddress(event.target.value);
                    if (emailError) {
                      setEmailError(null);
                    }
                  }}
                />
                {emailError ? (
                  <p className="text-xs font-mono text-red-400">{emailError}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-[0.35em] text-cyan-200/70">
                  Password
                </label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  className="border-cyan-400/50 bg-black/70 text-cyan-100 placeholder:text-cyan-200/35 focus-visible:ring-cyan-300 focus-visible:ring-offset-0"
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {errorMessage ? (
                <p className="text-xs font-mono text-red-400">{errorMessage}</p>
              ) : null}

              <Button
                type="submit"
                className="w-full bg-cyan-400 text-black hover:bg-cyan-300"
                disabled={!canSubmit}
              >
                {isSubmitting ? "CHECKING..." : "SIGN IN"}
              </Button>
            </form>
          )}

          {pendingVerification && (
            <form className="space-y-4" onSubmit={handleVerifyCode}>
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-[0.35em] text-cyan-200/70">
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
                  <p className="text-xs font-mono text-cyan-200/60">
                    Enter the 6-digit OTP sent to{" "}
                    {verificationTarget || emailAddress || "your NITT webmail"}.
                  </p>
                </div>
              </div>

              {errorMessage ? (
                <p className="text-xs font-mono text-red-400">{errorMessage}</p>
              ) : null}

              <Button
                type="submit"
                className="w-full bg-cyan-400 text-black hover:bg-cyan-300"
                disabled={code.trim().length !== 6 || isSubmitting}
              >
                {isSubmitting ? "VERIFYING..." : "VERIFY DEVICE"}
              </Button>

              <button
                type="button"
                className="w-full text-xs font-mono uppercase tracking-[0.35em] text-cyan-200/70 hover:text-cyan-200"
                onClick={() => {
                  setPendingVerification(false);
                  setCode("");
                  setErrorMessage(null);
                }}
              >
                Use Another Account
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
