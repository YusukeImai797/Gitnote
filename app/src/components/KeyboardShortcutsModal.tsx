interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string;
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  // Text Formatting
  { keys: 'Ctrl/Cmd + B', description: '太字', category: 'テキスト装飾' },
  { keys: 'Ctrl/Cmd + I', description: '斜体', category: 'テキスト装飾' },
  { keys: 'Ctrl/Cmd + U', description: '下線', category: 'テキスト装飾' },
  { keys: 'Ctrl/Cmd + Shift + X', description: '打ち消し線', category: 'テキスト装飾' },
  { keys: 'Ctrl/Cmd + E', description: 'インラインコード', category: 'テキスト装飾' },

  // Headings
  { keys: 'Ctrl/Cmd + Alt + 1', description: '大見出し (H1)', category: '見出し' },
  { keys: 'Ctrl/Cmd + Alt + 2', description: '中見出し (H2)', category: '見出し' },
  { keys: 'Ctrl/Cmd + Alt + 3', description: '小見出し (H3)', category: '見出し' },
  { keys: 'Ctrl/Cmd + Alt + 0', description: '本文', category: '見出し' },

  // Lists
  { keys: 'Ctrl/Cmd + Shift + 8', description: '箇条書きリスト', category: 'リスト' },
  { keys: 'Ctrl/Cmd + Shift + 7', description: '番号リスト', category: 'リスト' },
  { keys: 'Ctrl/Cmd + Shift + 9', description: 'タスクリスト', category: 'リスト' },

  // Other
  { keys: 'Ctrl/Cmd + K', description: 'リンクを挿入', category: 'その他' },
  { keys: 'Ctrl/Cmd + Shift + C', description: 'コードブロック', category: 'その他' },
  { keys: 'Ctrl/Cmd + Shift + B', description: '引用', category: 'その他' },
  { keys: 'Ctrl/Cmd + Enter', description: '区切り線を挿入', category: 'その他' },

  // Navigation
  { keys: 'Ctrl/Cmd + S', description: '保存 (自動保存有効)', category: 'ナビゲーション' },
  { keys: 'Esc', description: 'モーダルを閉じる', category: 'ナビゲーション' },
];

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const categories = Array.from(new Set(SHORTCUTS.map(s => s.category)));

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] overflow-y-auto p-4">
        <div className="bg-card rounded-2xl p-6 shadow-xl border border-border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">キーボードショートカット</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-subtle transition-colors"
              aria-label="閉じる"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>

          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {SHORTCUTS.filter(s => s.category === category).map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-subtle transition-colors"
                    >
                      <span className="text-sm text-foreground">{shortcut.description}</span>
                      <kbd className="px-3 py-1.5 text-xs font-mono font-semibold bg-muted border border-border rounded-lg shadow-sm">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              <kbd className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded">?</kbd>
              {' '}を押すとこのヘルプを表示できます
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
