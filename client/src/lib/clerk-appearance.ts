export const authClerkAppearance = {
  variables: {
    colorPrimary: "#00f5ff",
    colorText: "#e9ffff",
    colorTextSecondary: "#9aa8b5",
    colorBackground: "#06070b",
    colorInputBackground: "#0b1118",
    colorInputText: "#e9ffff",
    colorDanger: "#ff4d4d",
    fontFamily: "JetBrains Mono, monospace",
  },
  elements: {
    card: "bg-black/70 border border-cyan-400/40 shadow-[0_0_40px_rgba(0,255,255,0.15)] backdrop-blur-xl",
    headerTitle: "font-mono uppercase tracking-[0.4em] text-cyan-200 text-sm",
    headerSubtitle: "font-mono text-cyan-100/70 text-xs uppercase tracking-[0.35em]",
    formButtonPrimary:
      "bg-cyan-400 text-black font-mono uppercase tracking-[0.3em] text-xs hover:bg-cyan-300",
    formFieldInput:
      "bg-black/60 border border-cyan-500/40 text-cyan-50 placeholder:text-cyan-200/40",
    otpCodeFieldInput:
      "bg-black/70 border border-green-400/70 text-green-300 shadow-[0_0_18px_rgba(0,255,128,0.35)] focus:border-green-300 focus:ring-2 focus:ring-green-400/40",
    socialButtonsBlockButton:
      "border border-cyan-400/40 text-cyan-50 hover:bg-cyan-400/10",
    dividerLine: "bg-cyan-400/30",
    footerActionLink: "text-cyan-300 hover:text-cyan-200",
  },
};
