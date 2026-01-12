import { Suspense } from "react";
import SetupContent from "./SetupContent";

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <SetupContent />
    </Suspense>
  );
}
