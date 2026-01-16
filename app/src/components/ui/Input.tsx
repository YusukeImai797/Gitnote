"use client";

import { forwardRef, InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, icon, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={[
              "w-full px-4 py-2.5 rounded-xl",
              "bg-subtle border border-border",
              "text-foreground placeholder:text-muted-foreground",
              "outline-none transition-all duration-200",
              "focus:border-primary focus:ring-2 focus:ring-primary/10",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              icon ? "pl-10" : "",
              error ? "border-error focus:border-error focus:ring-error/10" : "",
              className,
            ].filter(Boolean).join(" ")}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-error">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
