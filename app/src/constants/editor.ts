// Editor constants and configuration

export const EDITOR_CONSTANTS = {
  MODAL_FOCUS_DELAY: 100,
  FLOATING_BUTTON_OFFSET: 16,
} as const;

export const BLOCK_MENU_ITEMS = [
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
] as const;

export type BlockMenuItem = typeof BLOCK_MENU_ITEMS[number];

/**
 * Check if a menu item icon is a Material Symbol
 */
export function isMaterialIcon(icon?: string): boolean {
  if (!icon) return false;
  return icon.startsWith('format_') ||
    icon.startsWith('check_') ||
    icon.startsWith('code_') ||
    icon.startsWith('horizontal_') ||
    icon === 'image';
}
