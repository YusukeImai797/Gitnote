"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect, useCallback, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { BLOCK_MENU_ITEMS, EDITOR_CONSTANTS, isMaterialIcon } from "@/constants/editor";
import ImageUploadModal from "./ImageUploadModal";

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

// Icon component for Material Symbols
function Icon({ name, filled = false, className = "" }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
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
      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all active:scale-95 ${isActive
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
      setTimeout(() => inputRef.current?.focus(), EDITOR_CONSTANTS.MODAL_FOCUS_DELAY);
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl border border-border animate-slide-up"
      >
        <h3
          className="text-lg font-semibold mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h3>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 rounded-xl border border-border bg-subtle outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 mb-4 transition-all"
        />
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

// Floating Block Menu component (mobile-friendly, appears near cursor)
// Uses React Portal to render directly in document.body to avoid transform issues with fixed positioning
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const menuContent = (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed bg-card border border-border rounded-2xl shadow-xl p-2 min-w-[220px] z-50 max-h-[320px] overflow-y-auto animate-slide-up"
        style={{ top: position.top, left: position.left }}
      >
        {BLOCK_MENU_ITEMS.map((item, index) => {
          if (item.type === 'divider') {
            return <div key={index} className="h-px bg-border my-2" />;
          }
          return (
            <button
              key={item.type}
              onClick={() => {
                onSelect(item.type);
                onClose();
              }}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left group"
            >
              <span className="flex items-center justify-center w-8 h-8 bg-primary/10 text-primary rounded-lg text-sm font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {isMaterialIcon(item.icon)
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

  return createPortal(menuContent, document.body);
}

export default function Editor({ content, onChange, placeholder = "Start writing..." }: EditorProps) {
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [floatingMenuPos, setFloatingMenuPos] = useState({ top: 0, left: 0 });
  const [floatingButtonPos, setFloatingButtonPos] = useState({ top: 16, visible: true });
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [linkDefaultValue, setLinkDefaultValue] = useState("");
  const [isInList, setIsInList] = useState(false);
  const [canIndent, setCanIndent] = useState(false);
  const [canOutdent, setCanOutdent] = useState(false);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
        // Disable Link from StarterKit since we configure it separately below
        link: false,
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
      // Check if cursor is in a list item
      updateListContext(editor);
    },
    onFocus: ({ editor }) => {
      updateFloatingButtonPosition();
      updateListContext(editor);
    },
    onCreate: () => {
      // Initialize floating button position when editor is created
      setTimeout(() => updateFloatingButtonPosition(), 100);
    },
    editorProps: {
      attributes: {
        class: "prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[350px] px-1 py-3",
      },
    },
  });

  // Check if cursor is in a list and update indent/outdent availability
  const updateListContext = useCallback((editorInstance: ReturnType<typeof useEditor>) => {
    if (!editorInstance) return;

    const inList = editorInstance.isActive('bulletList') ||
                   editorInstance.isActive('orderedList') ||
                   editorInstance.isActive('taskList');
    setIsInList(inList);

    if (inList) {
      // Check if we can indent (sink) - needs to have a previous sibling list item
      setCanIndent(editorInstance.can().sinkListItem('listItem') ||
                   editorInstance.can().sinkListItem('taskItem'));
      // Check if we can outdent (lift) - needs to be nested
      setCanOutdent(editorInstance.can().liftListItem('listItem') ||
                    editorInstance.can().liftListItem('taskItem'));
    } else {
      setCanIndent(false);
      setCanOutdent(false);
    }
  }, []);

  // Update floating button position based on cursor
  const updateFloatingButtonPosition = useCallback(() => {
    if (!editor || !editorContainerRef.current) return;

    const containerRect = editorContainerRef.current.getBoundingClientRect();

    // If editor is empty, show button at the top
    if (editor.isEmpty) {
      setFloatingButtonPos({
        top: 16,
        visible: true
      });
      return;
    }

    // Get the resolved position to find the current block node
    const { $from } = editor.state.selection;

    // Find the start of the current block (paragraph, heading, list item, etc.)
    const blockStart = $from.start($from.depth);

    // Try to get DOM coordinates for the block start position
    const coords = editor.view.coordsAtPos(blockStart);

    if (coords) {
      const topPos = coords.top - containerRect.top;
      setFloatingButtonPos({
        top: Math.max(0, topPos),
        visible: true
      });
      return;
    }

    // Fallback: Try to get the current node's DOM element
    const domNode = editor.view.nodeDOM($from.pos);

    if (domNode instanceof HTMLElement) {
      const nodeRect = domNode.getBoundingClientRect();
      const topPos = nodeRect.top - containerRect.top;

      setFloatingButtonPos({
        top: Math.max(0, topPos),
        visible: true
      });
      return;
    }

    // Last fallback: use selection range
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setFloatingButtonPos({
        top: 16,
        visible: true
      });
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.top === 0 && rect.left === 0) {
      setFloatingButtonPos({
        top: 16,
        visible: true
      });
      return;
    }

    const topPos = rect.top - containerRect.top + (rect.height / 2) - EDITOR_CONSTANTS.FLOATING_BUTTON_OFFSET;

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

  // Initialize floating button position when editor is ready
  useEffect(() => {
    if (editor) {
      updateFloatingButtonPosition();
    }
  }, [editor, updateFloatingButtonPosition]);

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

  const handleFloatingPlusClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent event from bubbling and causing focus changes
    e.preventDefault();
    e.stopPropagation();

    // Use mouse click position instead of button position
    // This is more reliable because the button may move due to focus changes
    const clickY = e.clientY;
    const clickX = e.clientX;

    // Calculate menu position relative to viewport (for fixed positioning)
    const menuTop = Math.min(
      clickY + 20, // 20px below the click
      window.innerHeight - 350 // Keep menu within viewport
    );
    const menuLeft = Math.max(16, clickX - 100); // Center menu roughly around click

    setFloatingMenuPos({
      top: menuTop,
      left: menuLeft
    });
    setShowFloatingMenu(true);
  }, []);

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
      {floatingButtonPos.visible && !showBlockMenu && !showFloatingMenu && !isInList && (
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

      {/* Floating indent controls for list items (mobile-friendly) */}
      {floatingButtonPos.visible && isInList && !showBlockMenu && !showFloatingMenu && (
        <div
          className="absolute left-0 -ml-12 flex flex-col gap-1 z-30"
          style={{ top: floatingButtonPos.top - 12 }}
        >
          {/* Outdent (move left / decrease indent) */}
          <button
            onClick={() => {
              if (editor?.isActive('taskList')) {
                editor?.chain().focus().liftListItem('taskItem').run();
              } else {
                editor?.chain().focus().liftListItem('listItem').run();
              }
            }}
            disabled={!canOutdent}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
              canOutdent
                ? 'bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground active:scale-95'
                : 'bg-muted/50 text-muted-foreground/30 cursor-not-allowed'
            }`}
            title="インデント減らす (階層を上げる)"
            type="button"
          >
            <Icon name="format_indent_decrease" className="text-base" />
          </button>
          {/* Indent (move right / increase indent) */}
          <button
            onClick={() => {
              if (editor?.isActive('taskList')) {
                editor?.chain().focus().sinkListItem('taskItem').run();
              } else {
                editor?.chain().focus().sinkListItem('listItem').run();
              }
            }}
            disabled={!canIndent}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
              canIndent
                ? 'bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground active:scale-95'
                : 'bg-muted/50 text-muted-foreground/30 cursor-not-allowed'
            }`}
            title="インデント増やす (階層を下げる)"
            type="button"
          >
            <Icon name="format_indent_increase" className="text-base" />
          </button>
        </div>
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
      <div className="sticky bottom-0 left-0 right-0 mt-6 py-1 px-3 bg-card/95 backdrop-blur-md border-t border-border/50 -mx-6 -mb-6 rounded-b-2xl opacity-50 hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <div className="flex items-center gap-1">
          {/* Add Block Button (note-style) - outside scroll container */}
          <div className="relative shrink-0" ref={blockMenuRef}>
            <button
              onClick={() => setShowBlockMenu(!showBlockMenu)}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground shadow-sm hover:scale-105 transition-transform"
              title="ブロックを追加"
              type="button"
            >
              <Icon name={showBlockMenu ? "close" : "add"} className="text-xl" />
            </button>
            {/* Block Menu for bottom toolbar */}
            {showBlockMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowBlockMenu(false)} />
                <div className="absolute left-0 bottom-full mb-2 bg-card border border-border rounded-2xl shadow-xl p-2 min-w-[220px] z-50 max-h-[320px] overflow-y-auto animate-slide-up">
                  {BLOCK_MENU_ITEMS.map((item, index) => {
                    if (item.type === 'divider') {
                      return <div key={index} className="h-px bg-border my-2" />;
                    }
                    return (
                      <button
                        key={item.type}
                        onClick={() => {
                          handleBlockSelect(item.type);
                          setShowBlockMenu(false);
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left group"
                      >
                        <span className="flex items-center justify-center w-8 h-8 bg-primary/10 text-primary rounded-lg text-sm font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          {isMaterialIcon(item.icon)
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
                onClick={() => {
                  // Cycle through: paragraph -> H1 -> H2 -> H3 -> paragraph
                  if (editor.isActive('heading', { level: 1 })) {
                    editor.chain().focus().toggleHeading({ level: 2 }).run();
                  } else if (editor.isActive('heading', { level: 2 })) {
                    editor.chain().focus().toggleHeading({ level: 3 }).run();
                  } else if (editor.isActive('heading', { level: 3 })) {
                    editor.chain().focus().setParagraph().run();
                  } else {
                    editor.chain().focus().toggleHeading({ level: 1 }).run();
                  }
                }}
                isActive={editor.isActive('heading')}
                title="見出し (クリックで切り替え)"
              >
                {editor.isActive('heading', { level: 1 }) ? (
                  <span className="text-sm font-bold">H1</span>
                ) : editor.isActive('heading', { level: 2 }) ? (
                  <span className="text-sm font-bold">H2</span>
                ) : editor.isActive('heading', { level: 3 }) ? (
                  <span className="text-sm font-bold">H3</span>
                ) : (
                  <Icon name="format_h1" />
                )}
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

            {/* Indent controls for mobile */}
            <ToolbarButton
              onClick={() => editor.chain().focus().liftListItem('listItem').run()}
              isActive={false}
              title="インデント減らす"
            >
              <Icon name="format_indent_decrease" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
              isActive={false}
              title="インデント増やす"
            >
              <Icon name="format_indent_increase" />
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

      {/* Image Upload Modal */}
      <ImageUploadModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        onSubmit={handleImageSubmit}
      />
    </div>
  );
}
