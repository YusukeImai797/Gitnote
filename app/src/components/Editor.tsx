"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect, useCallback, useState, useRef } from "react";

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

// Icon component for Material Symbols
function Icon({ name, filled = false, className = "" }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}
    >
      {name}
    </span>
  );
}

// Toolbar button component
function ToolbarButton({
  onClick,
  isActive = false,
  title,
  children
}: {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-all active:scale-95 ${isActive
          ? 'bg-primary/15 text-primary'
          : 'text-foreground hover:bg-subtle'
        }`}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

// Input Modal for Links and Images
function InputModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  placeholder,
  defaultValue = ""
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  placeholder: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(defaultValue);
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(value);
    setValue("");
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-4">
        <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-6 shadow-xl border border-border">
          <h3 className="text-lg font-bold mb-4">{title}</h3>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-3 rounded-xl border border-border bg-subtle/50 outline-none focus:ring-2 focus:ring-primary/20 mb-4"
          />
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-subtle"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold"
            >
              追加
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// Floating Block Menu component (mobile-friendly, appears near cursor)
function FloatingBlockMenu({
  isOpen,
  onClose,
  onSelect,
  position
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
  position: { top: number; left: number };
}) {
  const items = [
    { type: 'heading1', icon: 'H1', label: '大見出し' },
    { type: 'heading2', icon: 'H2', label: '中見出し' },
    { type: 'heading3', icon: 'H3', label: '小見出し' },
    { type: 'divider' },
    { type: 'bulletList', icon: 'format_list_bulleted', label: '箇条書き' },
    { type: 'orderedList', icon: 'format_list_numbered', label: '番号リスト' },
    { type: 'taskList', icon: 'check_box', label: 'タスクリスト' },
    { type: 'divider' },
    { type: 'blockquote', icon: 'format_quote', label: '引用' },
    { type: 'codeBlock', icon: 'code_blocks', label: 'コードブロック' },
    { type: 'horizontalRule', icon: 'horizontal_rule', label: '区切り線' },
    { type: 'image', icon: 'image', label: '画像' },
  ];

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed bg-card border border-border rounded-xl shadow-xl p-2 min-w-[200px] z-50 max-h-[300px] overflow-y-auto"
        style={{ top: position.top, left: position.left }}
      >
        {items.map((item, index) => {
          if (item.type === 'divider') {
            return <div key={index} className="h-px bg-border my-1" />;
          }
          return (
            <button
              key={item.type}
              onClick={() => {
                onSelect(item.type);
                onClose();
              }}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-subtle transition-colors text-left"
            >
              <span className="flex items-center justify-center w-7 h-7 bg-primary text-primary-foreground rounded-md text-xs font-bold">
                {item.icon?.startsWith('format_') || item.icon?.startsWith('check_') || item.icon?.startsWith('code_') || item.icon?.startsWith('horizontal_') || item.icon === 'image'
                  ? <Icon name={item.icon} className="text-base" />
                  : item.icon
                }
              </span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function Editor({ content, onChange, placeholder = "Start writing..." }: EditorProps) {
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [floatingMenuPos, setFloatingMenuPos] = useState({ top: 0, left: 0 });
  const [floatingButtonPos, setFloatingButtonPos] = useState({ top: 0, visible: false });
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [linkDefaultValue, setLinkDefaultValue] = useState("");
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Image,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
    onSelectionUpdate: ({ editor }) => {
      // Track cursor position for floating + button
      updateFloatingButtonPosition();
    },
    onFocus: () => {
      updateFloatingButtonPosition();
    },
    editorProps: {
      attributes: {
        class: "prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[350px] px-1 py-3",
      },
    },
  });

  // Update floating button position based on cursor
  const updateFloatingButtonPosition = useCallback(() => {
    if (!editor || !editorContainerRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setFloatingButtonPos({ top: 0, visible: false });
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = editorContainerRef.current.getBoundingClientRect();

    if (rect.top === 0 && rect.left === 0) {
      // No valid position
      setFloatingButtonPos({ top: 0, visible: false });
      return;
    }

    // Position button to the left of the current line
    const topPos = rect.top - containerRect.top + (rect.height / 2) - 16; // Center vertically

    setFloatingButtonPos({
      top: Math.max(0, topPos),
      visible: true
    });
  }, [editor]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Update position on window resize
  useEffect(() => {
    const handleResize = () => updateFloatingButtonPosition();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateFloatingButtonPosition]);

  const openLinkModal = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href || "";
    setLinkDefaultValue(previousUrl);
    setShowLinkModal(true);
  }, [editor]);

  const handleLinkSubmit = useCallback((url: string) => {
    if (!editor) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const handleImageSubmit = useCallback((url: string) => {
    if (!editor || !url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const handleFloatingPlusClick = useCallback(() => {
    if (!editorContainerRef.current) return;

    const containerRect = editorContainerRef.current.getBoundingClientRect();
    setFloatingMenuPos({
      top: floatingButtonPos.top + containerRect.top + 40,
      left: containerRect.left + 20
    });
    setShowFloatingMenu(true);
  }, [floatingButtonPos]);

  const handleBlockSelect = useCallback((type: string) => {
    if (!editor) return;

    switch (type) {
      case 'heading1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'heading2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'heading3':
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'orderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'taskList':
        editor.chain().focus().toggleTaskList().run();
        break;
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'codeBlock':
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'horizontalRule':
        editor.chain().focus().setHorizontalRule().run();
        break;
      case 'image':
        setShowImageModal(true);
        break;
    }
  }, [editor]);

  if (!editor) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="relative" ref={editorContainerRef}>
      {/* Floating + button near cursor (mobile-friendly) */}
      {floatingButtonPos.visible && !showBlockMenu && !showFloatingMenu && (
        <button
          onClick={handleFloatingPlusClick}
          className="absolute left-0 w-7 h-7 -ml-10 flex items-center justify-center rounded-full bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground transition-all z-30 opacity-60 hover:opacity-100"
          style={{ top: floatingButtonPos.top }}
          title="ブロックを追加"
          type="button"
        >
          <Icon name="add" className="text-lg" />
        </button>
      )}

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Floating Block Menu (for the floating + button) */}
      <FloatingBlockMenu
        isOpen={showFloatingMenu}
        onClose={() => setShowFloatingMenu(false)}
        onSelect={handleBlockSelect}
        position={floatingMenuPos}
      />

      {/* Floating Toolbar - sticky at bottom of editor card */}
      <div className="sticky bottom-0 left-0 right-0 mt-4 py-3 px-2 bg-card/98 backdrop-blur-md border-t border-border -mx-6 -mb-6 rounded-b-2xl">
        <div className="flex items-center gap-1">
          {/* Add Block Button (note-style) - outside scroll container */}
          <div className="relative shrink-0" ref={blockMenuRef}>
            <button
              onClick={() => setShowBlockMenu(!showBlockMenu)}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:scale-105 transition-transform mr-2"
              title="ブロックを追加"
              type="button"
            >
              <Icon name={showBlockMenu ? "close" : "add"} className="text-xl" />
            </button>
            {/* Block Menu for bottom toolbar */}
            {showBlockMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowBlockMenu(false)} />
                <div className="absolute left-0 bottom-full mb-2 bg-card border border-border rounded-xl shadow-lg p-2 min-w-[200px] z-50 max-h-[300px] overflow-y-auto">
                  {[
                    { type: 'heading1', icon: 'H1', label: '大見出し' },
                    { type: 'heading2', icon: 'H2', label: '中見出し' },
                    { type: 'heading3', icon: 'H3', label: '小見出し' },
                    { type: 'divider' },
                    { type: 'bulletList', icon: 'format_list_bulleted', label: '箇条書き' },
                    { type: 'orderedList', icon: 'format_list_numbered', label: '番号リスト' },
                    { type: 'taskList', icon: 'check_box', label: 'タスクリスト' },
                    { type: 'divider' },
                    { type: 'blockquote', icon: 'format_quote', label: '引用' },
                    { type: 'codeBlock', icon: 'code_blocks', label: 'コードブロック' },
                    { type: 'horizontalRule', icon: 'horizontal_rule', label: '区切り線' },
                    { type: 'image', icon: 'image', label: '画像' },
                  ].map((item, index) => {
                    if (item.type === 'divider') {
                      return <div key={index} className="h-px bg-border my-1" />;
                    }
                    return (
                      <button
                        key={item.type}
                        onClick={() => {
                          handleBlockSelect(item.type);
                          setShowBlockMenu(false);
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-subtle transition-colors text-left"
                      >
                        <span className="flex items-center justify-center w-7 h-7 bg-primary text-primary-foreground rounded-md text-xs font-bold">
                          {item.icon?.startsWith('format_') || item.icon?.startsWith('check_') || item.icon?.startsWith('code_') || item.icon?.startsWith('horizontal_') || item.icon === 'image'
                            ? <Icon name={item.icon} className="text-base" />
                            : item.icon
                          }
                        </span>
                        <span className="text-sm font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="w-px h-6 bg-border shrink-0" />

          {/* Scrollable toolbar area */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">

            {/* Text formatting */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              title="太字 (Ctrl+B)"
            >
              <Icon name="format_bold" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              title="斜体 (Ctrl+I)"
            >
              <Icon name="format_italic" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
              title="打ち消し線"
            >
              <Icon name="format_strikethrough" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              isActive={editor.isActive('code')}
              title="インラインコード"
            >
              <Icon name="code" />
            </ToolbarButton>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Headings dropdown */}
            <div className="relative group">
              <ToolbarButton
                onClick={() => { }}
                isActive={editor.isActive('heading')}
                title="見出し"
              >
                <Icon name="title" />
              </ToolbarButton>
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50">
                <div className="bg-card border border-border rounded-xl shadow-lg p-1.5 flex flex-col min-w-[130px]">
                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={`px-3 py-2 text-left rounded-lg hover:bg-subtle text-base font-extrabold transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    H1 大見出し
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`px-3 py-2 text-left rounded-lg hover:bg-subtle text-sm font-bold transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    H2 中見出し
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    className={`px-3 py-2 text-left rounded-lg hover:bg-subtle text-sm font-semibold transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    H3 小見出し
                  </button>
                  <button
                    onClick={() => editor.chain().focus().setParagraph().run()}
                    className={`px-3 py-2 text-left rounded-lg hover:bg-subtle text-sm transition-colors ${editor.isActive('paragraph') ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    本文
                  </button>
                </div>
              </div>
            </div>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Lists */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
              title="箇条書き"
            >
              <Icon name="format_list_bulleted" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
              title="番号リスト"
            >
              <Icon name="format_list_numbered" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              isActive={editor.isActive('taskList')}
              title="タスクリスト"
            >
              <Icon name="check_box" />
            </ToolbarButton>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Other */}
            <ToolbarButton
              onClick={openLinkModal}
              isActive={editor.isActive('link')}
              title="リンク"
            >
              <Icon name="link" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => setShowImageModal(true)}
              isActive={false}
              title="画像"
            >
              <Icon name="image" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
              title="引用"
            >
              <Icon name="format_quote" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              isActive={editor.isActive('codeBlock')}
              title="コードブロック"
            >
              <Icon name="code_blocks" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              isActive={false}
              title="区切り線"
            >
              <Icon name="horizontal_rule" />
            </ToolbarButton>
          </div>
        </div>
      </div>

      {/* Link Modal */}
      <InputModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onSubmit={handleLinkSubmit}
        title="リンクを追加"
        placeholder="https://example.com"
        defaultValue={linkDefaultValue}
      />

      {/* Image Modal */}
      <InputModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        onSubmit={handleImageSubmit}
        title="画像を追加"
        placeholder="https://example.com/image.jpg"
      />
    </div>
  );
}
