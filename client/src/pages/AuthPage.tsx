import { useEffect, useState } from "react";
import { Show, useUser } from "@clerk/react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

function App() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn } = useUser();
  const { isLoading: isApiLoading, isClerkSignedIn } = useAuth();

  useEffect(() => {
    const move = (e: MouseEvent) => {
      setMouse({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  return (
    <header className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-black text-white">

      {/* Mouse Glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(400px at ${mouse.x}px ${mouse.y}px, rgba(0,255,255,0.25), transparent 80%)`,
        }}
      />

      {/* Cyberpunk Grid Background */}
      <div className="absolute inset-0 z-0 opacity-30">
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,200,0.15) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Glow Orbs */}
      <div className="absolute w-[500px] h-[500px] bg-pink-500 blur-[200px] opacity-30 rounded-full top-[-100px] left-[-100px]" />
      <div className="absolute w-[500px] h-[500px] bg-cyan-400 blur-[200px] opacity-30 rounded-full bottom-[-100px] right-[-100px]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-10">

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-mono tracking-widest text-cyan-300 drop-shadow-[0_0_20px_cyan]">
          THE PRODUCT FOLKS - NITT
        </h1>

        <div className="inline-block border border-primary/50 bg-background/50 backdrop-blur-sm px-4 py-1.5 text-primary font-mono text-sm tracking-widest mb-8 brutal-shadow">
            AUTHENTICATE TO CONTINUE
        </div>

        <Show when="signed-out">
          <div className="flex flex-col md:flex-row gap-6 items-center justify-center">
            <button
              className="px-10 py-3 font-mono tracking-widest text-cyan-300 border border-cyan-400 bg-black/40 backdrop-blur-lg rounded-xl hover:bg-cyan-400/10 hover:shadow-[0_0_20px_cyan] transition-all duration-300"
              onClick={() => setLocation("/sign-in")}
            >
              SIGN IN
            </button>

            <button
              className="px-10 py-3 font-mono tracking-widest text-pink-400 border border-pink-500 bg-black/40 backdrop-blur-lg rounded-xl hover:bg-pink-500/10 hover:shadow-[0_0_20px_pink] transition-all duration-300"
              onClick={() => setLocation("/sign-up")}
            >
              SIGN UP
            </button>

          </div>
        </Show>

        <Show when="signed-in">
          {isLoaded && isSignedIn && !isApiLoading && isClerkSignedIn ? (
            <Redirect to="/projects" />
          ) : null}
        </Show>
      </div>

      {/* Scanlines Overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-10 z-20"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.05), rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)",
        }}
      />

    </header>
  );
}

export default App;
