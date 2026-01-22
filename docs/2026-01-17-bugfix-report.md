# Gitnote バグ修正レポート (2026-01-17)

## 概要

エディタのUIに関する4つの問題を修正し、v0.2.5としてデプロイしました。

## 修正した問題

### 1. フローティング+ボタンのメニュー位置問題 (重要)

**症状:** PC版でフローティングの+ボタンをクリックすると、ボタンから離れた場所にメニューが表示される

**根本原因:**
- メニューは`position: fixed`で配置されていた
- 親要素の`.animate-slide-up`クラスが`transform: translateY(0)`を適用
- CSSの仕様では、`transform`を持つ要素は子要素の`position: fixed`の基準点を変更する
- そのため、ビューポート基準で計算した座標（`e.clientY`, `e.clientX`）がずれていた

**修正内容:**
- React Portalを使用して`FloatingBlockMenu`を`document.body`直下にレンダリング
- これにより親要素のtransformの影響を受けずに正しく配置される

**関連ファイル:** `app/src/components/Editor.tsx`

```tsx
// 修正前: 通常のReactコンポーネントとしてレンダリング
return (
  <>
    <div className="fixed inset-0 z-40" onClick={onClose} />
    <div className="fixed ..." style={{ top, left }}>...</div>
  </>
);

// 修正後: React Portalでdocument.body直下にレンダリング
return createPortal(menuContent, document.body);
```

### 2. TipTap Link拡張機能の重複警告

**症状:** コンソールに「Duplicate extension names found: ['link']」という警告が表示される

**原因:** TipTap v3のStarterKitにはデフォルトでLink拡張機能が含まれるようになった。コードでは別途カスタム設定のLinkを追加していたため重複が発生。

**修正内容:** StarterKitの設定で`link: false`を追加し、内蔵のLinkを無効化

**関連ファイル:** `app/src/components/Editor.tsx`

```tsx
StarterKit.configure({
  heading: { levels: [1, 2, 3, 4] },
  link: false, // 追加: カスタムLinkを使用するため無効化
}),
```

### 3. フッターの見出しボタン改善

**症状:** フッターツールバーの見出しボタンではH1しか指定できず、他のメニュー（H2/H3選択可能）と整合性がない

**修正内容:** 見出しボタンをクリックするとH1→H2→H3→段落とサイクルするように変更。また、ホバー時にドロップダウンメニューで直接選択も可能。

**関連ファイル:** `app/src/components/Editor.tsx` (617-670行付近)

### 4. コンフリクト解決後の再表示問題

**症状:** コンフリクトが検出されリモートバージョンを選択した後、再びコンフリクト検出画面が表示される

**修正内容:**
- `isResolvingConflict` refを追加し、解決処理中はコンフリクトチェックをスキップ
- `handleVisibilityChange`でフラグをチェック
- `handleUseRemote`でフラグを設定/解除

**関連ファイル:** `app/src/app/editor/EditorContent.tsx`

```tsx
const isResolvingConflict = useRef(false);

// handleVisibilityChange内
if (showConflictModal || isResolvingConflict.current) {
  console.log('[SYNC] Visibility change: Skipping check, conflict resolution in progress');
  return;
}

// handleUseRemote内
isResolvingConflict.current = true;
try {
  // ... 処理
} finally {
  setTimeout(() => {
    isResolvingConflict.current = false;
  }, 500);
}
```

## デプロイ情報

- **最終バージョン:** v0.2.5
- **デプロイ方法:** `cd app && vercel --prod --yes`
- **本番URL:** https://app-hazel-two-14.vercel.app

### バージョン履歴（本日分）
| バージョン | 内容 |
|-----------|------|
| v0.2.3 | メニュー位置修正の試み（クリック座標使用）- 効果なし |
| v0.2.4 | Link重複警告の修正 |
| v0.2.5 | React Portalによるメニュー位置の根本修正 |

## 技術的な学び

### CSSのtransformとposition: fixedの関係

CSSの仕様では、`transform`、`perspective`、`will-change`、`filter`などのプロパティを持つ要素は、その子要素の`position: fixed`の基準点（containing block）をビューポートから自身に変更します。

これは「stacking context」とは別の概念で、見落としやすいバグの原因になります。

**対策:**
1. React Portalで親の影響を受けない場所にレンダリング
2. アニメーション完了後にtransformを削除する
3. fixedではなくabsoluteを使用し、相対座標で計算する

## 残存する軽微な問題

- `EditorContent.tsx`に未使用変数の警告あり（`session`, `remoteContent`）
- `returnValue`の非推奨警告（beforeunloadイベント）

これらは機能に影響しないため、今後のリファクタリングで対応予定。

## 次回作業者へのメモ

1. **デプロイ:** Vercel CLIでの手動デプロイが必要（`vercel --prod --yes`）。Git pushだけでは自動デプロイされない場合あり。

2. **バージョン表示:** エディタ画面中央上部にバージョン番号を表示している。デプロイ確認に使用可能。

3. **フローティングボタン:** カーソル位置追従機能は`updateFloatingButtonPosition`関数で実装。TipTapの`onSelectionUpdate`と`onFocus`で呼び出される。
