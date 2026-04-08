import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const LiquidGlassButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          "relative overflow-hidden inline-flex items-center justify-center px-10 py-5",
          "bg-background/20 backdrop-blur-md border-2 border-primary",
          "text-primary font-display font-bold text-xl uppercase tracking-[0.2em]",
          "hover:bg-primary/10 hover:shadow-[0_0_40px_rgba(0,255,255,0.4)] hover:scale-105",
          "transition-all duration-300 ease-out group cursor-pointer brutal-shadow",
          className
        )}
        ref={ref}
        {...props}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent -translate-x-[200%] group-hover:animate-shimmer" />
        <span className="relative z-10">{props.children}</span>
      </Comp>
    );
  }
);
LiquidGlassButton.displayName = "LiquidGlassButton";
