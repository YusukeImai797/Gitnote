import { Suspense } from "react";
import EditorContent from "./EditorContent";

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <EditorContent />
    </Suspense>
  );
}
