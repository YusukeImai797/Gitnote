# Gitnote UI/UX リデザイン提案書
## Editorial/Magazine スタイル

**作成日**: 2026-01-13
**バージョン**: 1.0
**対象プラットフォーム**: Web（モバイル最優先、レスポンシブ）

---

## 1. デザインコンセプト

### 1.1 ビジョン

> **"読み手のためのエディタ、書き手のための静寂"**

Gitnoteは「思いついた時にストレスなく書き、Gitを通じて資産として残る」アプリです。Editorial/Magazineスタイルを採用することで、ユーザーが書いた文章そのものを主役とし、UIは「見えるが邪魔しない」存在へと昇華させます。

### 1.2 設計原則

1. **Content First（コンテンツ優先）**: 文章が常に視覚的に最も目立つ存在であること
2. **Typographic Hierarchy（タイポグラフィ階層）**: 見出し・本文・メタ情報が明確に区別されること
3. **Generous Whitespace（余白の贅沢）**: 情報密度より読みやすさを優先
4. **Quiet Confidence（控えめな自信）**: UIは必要な時だけ存在を主張する
5. **Progressive Disclosure（段階的開示）**: 初心者には優しく、パワーユーザーには深みを

---

## 2. カラーパレット

### 2.1 ライトモード

| 役割 | カラー名 | HEX | CSS変数 |
|------|----------|-----|---------|
| **Background** | Warm Parchment | `#FAF9F7` | `--background` |
| **Surface** | Pure White | `#FFFFFF` | `--surface` |
| **Foreground** | Rich Ink | `#1A1A1A` | `--foreground` |
| **Primary** | Editorial Navy | `#1E3A5F` | `--primary` |
| **Primary Foreground** | White | `#FFFFFF` | `--primary-foreground` |
| **Secondary** | Warm Terracotta | `#C17F59` | `--secondary` |
| **Accent** | Deep Burgundy | `#8B2635` | `--accent` |
| **Muted** | Soft Gray | `#F5F4F2` | `--muted` |
| **Muted Foreground** | Medium Gray | `#6B6B6B` | `--muted-foreground` |
| **Border** | Subtle Line | `#E8E6E3` | `--border` |
| **Subtle** | Near White | `#F9F8F6` | `--subtle` |

### 2.2 ダークモード

| 役割 | カラー名 | HEX | CSS変数 |
|------|----------|-----|---------|
| **Background** | Deep Charcoal | `#121212` | `--background` |
| **Surface** | Elevated Surface | `#1E1E1E` | `--surface` |
| **Foreground** | Soft White | `#ECECEC` | `--foreground` |
| **Primary** | Muted Navy | `#5A7FA8` | `--primary` |
| **Primary Foreground** | White | `#FFFFFF` | `--primary-foreground` |
| **Secondary** | Warm Terracotta | `#D4956D` | `--secondary` |
| **Accent** | Soft Burgundy | `#B84D5A` | `--accent` |
| **Muted** | Dark Gray | `#252525` | `--muted` |
| **Muted Foreground** | Light Gray | `#9A9A9A` | `--muted-foreground` |
| **Border** | Subtle Dark | `#2D2D2D` | `--border` |
| **Subtle** | Near Black | `#1A1A1A` | `--subtle` |

### 2.3 セマンティックカラー

| 状態 | Light | Dark | 用途 |
|------|-------|------|------|
| Success | `#2D7D46` | `#4CAF7A` | 同期完了 |
| Warning | `#C17F59` | `#D4956D` | オフライン |
| Error | `#8B2635` | `#B84D5A` | 競合・エラー |
| Info | `#1E3A5F` | `#5A7FA8` | 情報表示 |

---

## 3. タイポグラフィ

### 3.1 フォント選定

#### 見出し用（Serif）
**Cormorant Garamond** - Google Fonts
- ウェイト: 400, 500, 600, 700
- 特徴: エレガントで可読性の高いセリフ体。雑誌の見出しに最適

#### 本文用（Sans-serif）
**Source Sans 3** - Google Fonts
- ウェイト: 300, 400, 500, 600
- 特徴: Adobeが開発した高可読性サンセリフ

#### コード用（Monospace）
**JetBrains Mono** - Google Fonts
- ウェイト: 400, 500
- 特徴: 開発者向けに設計された高可読性等幅フォント

### 3.2 タイプスケール

| 要素 | モバイル | デスクトップ | Line Height | Font |
|------|----------|-------------|-------------|------|
| **Display** | 36px | 48px | 1.1 | Cormorant Garamond 700 |
| **H1** | 28px | 36px | 1.2 | Cormorant Garamond 600 |
| **H2** | 24px | 28px | 1.25 | Cormorant Garamond 600 |
| **H3** | 20px | 22px | 1.3 | Cormorant Garamond 500 |
| **Body** | 16px | 17px | 1.75 | Source Sans 3 400 |

---

## 4. 主要画面のレイアウト改善案

### 4.1 エディタ画面
- ヘッダー: 高さ56px、背景色は`--surface`、下ボーダーなし（影のみで分離）
- タイトル入力: Cormorant Garamond 600, 28px/36px
- 本文エリア: 最大幅680px、行間1.75
- ツールバー: 通常時opacity 0.3、フォーカス時完全表示

### 4.2 ライブラリ画面
- 検索バー: 高さ48px、角丸12px
- ノートカード: パディング20-24px、タイトルセリフ体
- フィルタータブ: ピル型ボタン

### 4.3 設定画面
- セクションヘッダー: Source Sans 3 600, 12px, letter-spacing 0.1em
- 入力フィールド: 高さ48px、角丸8px

---

## 5. コンポーネントデザイン

### 5.1 ボタンスタイル
- **Primary**: bg-primary (#1E3A5F), 角丸8px, 高さ44px
- **Secondary**: ゴースト（透明背景）, border 1px
- **Destructive**: bg-accent (#8B2635)

### 5.2 カード
- 角丸: 16px
- パディング: 24px
- 影: 0 1px 3px rgba(0,0,0,0.04)
- ホバー: translateY(-2px)

---

## 6. アニメーション

### 6.1 ページトランジション
- Fade + Slide (opacity + translateY 8px)
- Duration: 300ms ease-out

### 6.2 同期状態
- Synced: gentle pulse
- Syncing: elegant rotation
- Error: subtle shake

---

## 7. 改善優先度リスト

### 高優先度（Phase 1）
1. カラーパレットの刷新
2. フォントの変更
3. globals.css のリファクタリング
4. エディタのタイトル入力改善
5. エディタ本文エリアの余白調整

### 中優先度（Phase 2）
6. ボタンコンポーネントの統一
7. カードコンポーネントの改善
8. ライブラリ画面のレイアウト改善
9. ボトムナビゲーションのスタイル更新
10. モーダルデザインの統一

### 低優先度（Phase 3）
11. ページトランジション実装
12. マイクロインタラクション追加
13. 設定画面のレイアウト改善
14. ダークモードの微調整
15. アクセシビリティ監査

---

## 8. CSS変数 完全定義

```css
:root {
  /* Colors */
  --background: #FAF9F7;
  --surface: #FFFFFF;
  --foreground: #1A1A1A;
  --primary: #1E3A5F;
  --primary-foreground: #FFFFFF;
  --secondary: #C17F59;
  --accent: #8B2635;
  --muted: #F5F4F2;
  --muted-foreground: #6B6B6B;
  --border: #E8E6E3;
  --subtle: #F9F8F6;

  /* Semantic */
  --success: #2D7D46;
  --warning: #C17F59;
  --error: #8B2635;
  --info: #1E3A5F;

  /* Typography */
  --font-heading: 'Cormorant Garamond', Georgia, serif;
  --font-body: 'Source Sans 3', 'Helvetica Neue', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Spacing */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08);

  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.2s ease;
}

.dark {
  --background: #121212;
  --surface: #1E1E1E;
  --foreground: #ECECEC;
  --primary: #5A7FA8;
  --secondary: #D4956D;
  --accent: #B84D5A;
  --muted: #252525;
  --muted-foreground: #9A9A9A;
  --border: #2D2D2D;
  --subtle: #1A1A1A;

  --success: #4CAF7A;
  --warning: #D4956D;
  --error: #B84D5A;
  --info: #5A7FA8;
}
```

---

## 9. 実装対象ファイル

1. **globals.css** - カラー・タイポグラフィ定義
2. **layout.tsx** - Google Fonts読み込み
3. **EditorContent.tsx** - エディタレイアウト
4. **library/page.tsx** - ライブラリ画面
5. **Editor.tsx** - TipTapスタイリング
