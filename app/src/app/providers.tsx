"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import BottomNav from "@/components/BottomNav";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <div className="pb-24">
          {children}
        </div>
        <BottomNav />
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </SessionProvider>
  );
}
