# Gitnote 実装タスクリスト

## Phase 1: リポジトリ接続機能の完成

### 1.1 リポジトリ接続フロー ✅
- [x] GitHub OAuth認証実装
- [x] /api/github/repos 実装（リポジトリ一覧取得）
- [x] /connect ページUI実装
- [x] GitHub App Private Key修正
- [ ] Connect Repositoryボタンの動作確認
- [ ] repo_connectionsテーブルへの保存確認
- [ ] ホームページでリポジトリ接続状態表示

### 1.2 エラーハンドリング
- [ ] リポジトリ接続失敗時のエラー表示
- [ ] GitHub API制限エラーの処理
- [ ] ネットワークエラーの処理

---

## Phase 2: ラベルインポート機能

### 2.1 データベーススキーマ
- [ ] tag_mappings テーブル作成
  ```sql
  create table if not exists tag_mappings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    repo_connection_id uuid not null references repo_connections(id) on delete cascade,
    tag_name text not null,
    target_path text not null,
    color text default '#4913EC',
    description text,
    is_default boolean default false,
    github_label_id bigint,
    github_synced boolean default true,
    last_synced_at timestamptz,
    sync_status text default 'synced',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    unique(repo_connection_id, tag_name)
  );
  ```
- [ ] label_sync_logs テーブル作成（オプション）
- [ ] インデックス作成
- [ ] 更新トリガー設定

### 2.2 GitHub Labels取得API
- [ ] GET /api/labels/github 実装
  - [ ] GitHub Issues APIでラベル取得
  - [ ] リポジトリ接続確認
  - [ ] エラーハンドリング
  - [ ] レスポンス形式定義

### 2.3 ラベルインポートUI
- [ ] /connect/labels ページ作成
- [ ] GitHub Labelsの一覧表示
- [ ] チェックボックスで選択可能に
- [ ] 「Import Selected Labels」ボタン実装
- [ ] 「Skip」ボタン実装

### 2.4 パスマッピング設定UI
- [ ] /connect/mapping ページ作成
- [ ] 各ラベルにパス入力フィールド表示
- [ ] デフォルトパス自動設定（`notes/<label_name>/`）
- [ ] 既存フォルダスキャン機能（オプション）
- [ ] 「Confirm」でtag_mappingsに保存

### 2.5 初回接続フロー統合
- [ ] /connect → /connect/labels → /connect/mapping → / の遷移実装
- [ ] フロー状態の管理（どこまで完了したか）
- [ ] 各ステップでのバリデーション

---

## Phase 3: ラベル管理機能

### 3.1 ラベル一覧取得API
- [ ] GET /api/labels 実装
  - [ ] tag_mappingsから取得
  - [ ] ユーザー・リポジトリでフィルタ
  - [ ] deleted_at IS NULL で絞り込み

### 3.2 ラベル作成API
- [ ] POST /api/labels 実装
  - [ ] tag_mappingsに保存
  - [ ] GitHub Labelも作成（octokit.issues.createLabel）
  - [ ] 同期ステータス管理
  - [ ] エラー時のロールバック

### 3.3 ラベル更新API
- [ ] PUT /api/labels/:id 実装
  - [ ] tag_mappings更新
  - [ ] GitHub Label更新（octokit.issues.updateLabel）
  - [ ] 競合処理

### 3.4 ラベル削除API
- [ ] DELETE /api/labels/:id 実装
  - [ ] ソフトデリート（deleted_atに日時設定）
  - [ ] GitHub側は残す（オプションで削除可能に）
  - [ ] 関連ノートの処理

### 3.5 ラベル同期API
- [ ] POST /api/labels/sync 実装
  - [ ] GitHub Labelsを取得
  - [ ] tag_mappingsと差分検出
  - [ ] 新規ラベルをインポート
  - [ ] 更新されたラベルを反映
  - [ ] 削除されたラベルをアーカイブ

---

## Phase 4: エディタ統合

### 4.1 エディタページ基本実装
- [ ] /editor ページ作成
- [ ] TipTapエディタ統合
- [ ] Markdownプレビュー機能

### 4.2 ラベル選択UI
- [ ] エディタ上部にラベルチップ表示
- [ ] クリックで選択/解除
- [ ] 複数ラベル選択可能
- [ ] ラベルの色表示

### 4.3 新規ラベル作成（エディタから）
- [ ] [+]ボタン実装
- [ ] モーダルまたはインライン入力フィールド
- [ ] ラベル名入力
- [ ] 色選択（デフォルトはランダム）
- [ ] 作成後、即座に選択状態に
- [ ] バックグラウンドでPOST /api/labels

### 4.4 保存先パス自動決定
- [ ] 選択されたラベルからtag_mappingを取得
- [ ] target_pathを使ってファイルパス決定
- [ ] ラベルなしの場合は<base_path>/直下

### 4.5 自動保存機能
- [ ] ローカルストレージ（IndexedDB）への保存
- [ ] 30秒無操作でGitHub同期
- [ ] 「Done」ボタンで即座同期
- [ ] 保存状態の表示（Draft / Saving / Saved）

---

## Phase 5: ノート同期機能

### 5.1 ノート作成API
- [ ] POST /api/notes 実装
  - [ ] Front Matter生成（YAML）
  - [ ] ファイルパス決定（ラベルベース）
  - [ ] GitHub APIでファイル作成
  - [ ] notesテーブルに保存
  - [ ] コミットSHA保存

### 5.2 ノート更新API
- [ ] PUT /api/notes/:id 実装
  - [ ] SHA競合チェック
  - [ ] GitHub APIでファイル更新
  - [ ] notesテーブル更新
  - [ ] 競合時の処理

### 5.3 ノート取得API
- [ ] GET /api/notes/:id 実装
  - [ ] notesテーブルから取得
  - [ ] GitHub APIでファイル内容取得
  - [ ] Front Matter解析
  - [ ] Markdown本文抽出

### 5.4 ノート一覧API
- [ ] GET /api/notes 実装
  - [ ] ページネーション
  - [ ] タグフィルタ
  - [ ] 検索機能
  - [ ] ソート（更新日時、作成日時）

### 5.5 同期ジョブ
- [ ] sync_jobs テーブル使用
- [ ] バックグラウンド同期
- [ ] リトライ処理
- [ ] エラーログ

---

## Phase 6: ライブラリページ

### 6.1 ライブラリページ基本実装
- [ ] /library ページ作成
- [ ] ノート一覧表示
- [ ] カード形式のレイアウト

### 6.2 フィルタ・検索機能
- [ ] タグでフィルタ
- [ ] タイトル検索
- [ ] 日付範囲指定
- [ ] ステータスフィルタ（Draft / Synced / Conflict）

### 6.3 ノートプレビュー
- [ ] カードにタイトル、抜粋、タグ表示
- [ ] 最終更新日時表示
- [ ] 同期ステータスアイコン

### 6.4 ノート操作
- [ ] クリックでエディタに遷移
- [ ] 削除機能
- [ ] 複製機能

---

## Phase 7: 設定ページ

### 7.1 リポジトリ設定
- [ ] 接続中のリポジトリ情報表示
- [ ] Base Path変更機能
- [ ] リポジトリ切断機能

### 7.2 ラベル管理画面
- [ ] /settings/labels ページ作成
- [ ] ラベル一覧表示
- [ ] ラベル編集モーダル
- [ ] ラベル削除確認ダイアログ
- [ ] 「Sync with GitHub Labels」ボタン

### 7.3 アカウント設定
- [ ] プロフィール情報表示
- [ ] サインアウト機能

---

## Phase 8: GitHub Webhook統合（完全双方向同期）

### 8.1 Webhookエンドポイント
- [ ] POST /api/webhooks/github 実装
- [ ] 署名検証（X-Hub-Signature-256）
- [ ] イベント種別判定（x-github-event）

### 8.2 ラベルイベント処理
- [ ] label.created イベント処理
  - [ ] tag_mappingsに追加
- [ ] label.edited イベント処理
  - [ ] tag_mappings更新
- [ ] label.deleted イベント処理
  - [ ] tag_mappingsをアーカイブ

### 8.3 GitHub App設定
- [ ] Webhook URL設定（本番環境）
- [ ] Webhook Secret設定
- [ ] ラベルイベント有効化

### 8.4 ローカル開発用設定
- [ ] ngrokまたはsmeeでローカルWebhook受信
- [ ] 開発環境用Webhook設定

---

## Phase 9: UI/UX改善

### 9.1 ローディング状態
- [ ] スケルトンローディング実装
- [ ] スピナー実装
- [ ] プログレスバー実装

### 9.2 エラー表示
- [ ] トースト通知実装
- [ ] エラーバウンダリ実装
- [ ] 404ページ
- [ ] 500ページ

### 9.3 レスポンシブデザイン
- [ ] モバイル対応（ボトムナビ）
- [ ] タブレット対応
- [ ] デスクトップ（3ペインレイアウト）

### 9.4 アニメーション
- [ ] ページ遷移アニメーション
- [ ] モーダルのフェードイン/アウト
- [ ] ボタンホバーエフェクト

### 9.5 ダークモード
- [ ] ダークモード実装
- [ ] テーマ切り替え機能
- [ ] システム設定に追従

---

## Phase 10: テスト・品質保証

### 10.1 単体テスト
- [ ] API Routeのテスト
- [ ] ユーティリティ関数のテスト
- [ ] コンポーネントのテスト

### 10.2 統合テスト
- [ ] 認証フローのテスト
- [ ] リポジトリ接続フローのテスト
- [ ] ノート作成・更新フローのテスト

### 10.3 E2Eテスト
- [ ] Playwrightセットアップ
- [ ] 主要フローのE2Eテスト

### 10.4 パフォーマンス最適化
- [ ] 画像最適化
- [ ] コード分割
- [ ] キャッシング戦略

---

## Phase 11: デプロイ・本番環境

### 11.1 Vercelデプロイ
- [ ] プロジェクト作成
- [ ] 環境変数設定
- [ ] ドメイン設定

### 11.2 GitHub App本番設定
- [ ] 本番URLでGitHub App更新
- [ ] Webhook URL設定
- [ ] OAuth Callback URL設定

### 11.3 Supabase本番設定
- [ ] 本番データベース作成
- [ ] スキーマ適用
- [ ] RLS設定（オプション）

### 11.4 モニタリング
- [ ] エラートラッキング（Sentry等）
- [ ] アナリティクス設定
- [ ] ログ管理

---

## 現在の進捗状況

### 完了 ✅
- Phase 1.1: リポジトリ接続フロー（Connect Repositoryボタン以外）

### 進行中 🚧
- Phase 1.1: Connect Repositoryボタンの動作確認

### 次のタスク 📋
1. Connect Repositoryボタンのテスト
2. repo_connectionsへの保存確認
3. Phase 2開始: tag_mappingsテーブル作成

---

## 優先度マトリクス

### 最優先（MVP必須）
- Phase 1: リポジトリ接続
- Phase 2: ラベルインポート
- Phase 4: エディタ統合
- Phase 5: ノート同期
- Phase 6: ライブラリページ

### 高優先度
- Phase 3: ラベル管理
- Phase 7: 設定ページ
- Phase 9.2: エラー表示

### 中優先度
- Phase 8: GitHub Webhook
- Phase 9.1, 9.3, 9.4: UI/UX改善

### 低優先度（後回し可）
- Phase 9.5: ダークモード
- Phase 10: テスト
- Phase 11: デプロイ（MVP動作確認後）

---

## 見積もり（参考）

- **Phase 1完了**: 1-2時間
- **Phase 2完了**: 3-4時間
- **Phase 3完了**: 2-3時間
- **Phase 4完了**: 4-5時間
- **Phase 5完了**: 5-6時間
- **Phase 6完了**: 3-4時間
- **Phase 7完了**: 2-3時間
- **MVP合計**: 20-27時間

※あくまで目安。実際の進捗に応じて調整。
