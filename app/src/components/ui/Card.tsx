"use client";

import { HTMLAttributes, forwardRef } from "react";

type CardHover = 'none' | 'lift' | 'glow' | 'border';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: CardHover;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  paper?: boolean;
}

const hoverStyles: Record<CardHover, string> = {
  none: "",
  lift: "hover:-translate-y-1 hover:shadow-lg transition-all duration-300",
  glow: "hover:shadow-[0_0_30px_rgba(44,62,80,0.08)] transition-shadow duration-300",
  border: "hover:border-primary/30 transition-colors duration-300",
};

const paddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", hover = 'lift', padding = 'md', paper, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={[
          "bg-card text-card-foreground rounded-2xl border border-border shadow-sm",
          paper ? "bg-paper" : "",
          hoverStyles[hover],
          paddingStyles[padding],
          className,
        ].filter(Boolean).join(" ")}
        {...props}
      >
        {paper ? <div className="relative z-10">{children}</div> : children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
