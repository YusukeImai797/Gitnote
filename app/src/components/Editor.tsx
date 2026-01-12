"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect } from "react";

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export default function Editor({ content, onChange, placeholder = "Start writing..." }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
      Link.configure({
        openOnClick: false,
      }),
      Image,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content,
    immediatelyRender: false, // Fix SSR hydration mismatch in Next.js
    onUpdate: ({ editor }) => {
      const markdown = editor.getText();
      onChange(markdown);
    },
    editorProps: {
      attributes: {
        class: "prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-4 py-3",
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getText()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-2 border-b border-zinc-200 dark:border-border pb-2">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded px-2 py-1 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-muted ${editor.isActive("bold") ? "bg-zinc-200 dark:bg-muted" : ""
            }`}
          title="Bold"
        >
          B
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded px-2 py-1 text-sm font-medium italic hover:bg-zinc-100 ${editor.isActive("italic") ? "bg-zinc-200" : ""
            }`}
          title="Italic"
        >
          I
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded px-2 py-1 text-sm hover:bg-zinc-100 ${editor.isActive("bulletList") ? "bg-zinc-200" : ""
            }`}
          title="Bullet List"
        >
          •
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`rounded px-2 py-1 text-sm hover:bg-zinc-100 ${editor.isActive("orderedList") ? "bg-zinc-200" : ""
            }`}
          title="Ordered List"
        >
          1.
        </button>
        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`rounded px-2 py-1 text-sm hover:bg-zinc-100 ${editor.isActive("taskList") ? "bg-zinc-200" : ""
            }`}
          title="Task List"
        >
          ✓
        </button>
        <button
          onClick={() => {
            const url = window.prompt("Enter URL:");
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          className={`rounded px-2 py-1 text-sm hover:bg-zinc-100 ${editor.isActive("link") ? "bg-zinc-200" : ""
            }`}
          title="Link"
        >
          🔗
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
