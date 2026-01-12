# 製品仕様書：Gitnote - Stress-Free Markdown Editor (Git Sync)

## 0. 改定メモ（PlanとMockの差分整理）

- **名称:** リポジトリ名に合わせて Gitnote を正式名称とする。モック内の MarkSync / MarkFlow 表記はGitnoteへ差し替え。
- **コンセプト優先:** 「思いついた時にストレスなく書く」「Gitに残る」を最優先とする。
- **同期対象:** MVPはGit連携を中心に実装。Drive連携はUIを用意しつつ実装は後続フェーズへ。
- **ログイン/権限:** ログインはGitHub OAuth、リポジトリ操作はGitHub App。Drive連携導入時にGoogle OAuthを追加。
- **バックエンド環境:** Vercel + Supabase（Postgres）
- **画面構成:** モックの情報設計を採用（モバイルはボトムナビ、PCは3ペイン）。
- **保存体験:** 明示的な保存ボタンは置かず、自動保存＋「Done」で画面遷移のみ。

## 1. プロジェクト概要

「思いついた時にストレスなく書き、それがGitを通じて資産として残る」ことを目的としたWebベースのマークダウンエディタ。

- **ターゲット:** MarkdownやGitに詳しくないが、情報を構造的に残したいユーザー
- **プラットフォーム:** Webアプリ（モバイル最優先、レスポンシブ）
- **主要体験:** 起動即エディタ、自動保存、タグ/フォルダベースの整理

## 2. スコープ定義

### MVP
- GitHub OAuthでログインし、GitHub Appで1つのリポジトリを接続
- ノート作成 / 編集 / 自動保存 / Gitへの自動コミット
- ライブラリ（Inbox + タグ別一覧）とステータス表示（保存済み / 同期中 / 競合）
- 簡易検索（タイトル + タグ + 直近更新）

### 後続フェーズ
- Google Drive同期（任意のバックアップ先）
- 複数リポジトリ切り替え
- 共同編集 / コメント
- ネイティブアプリ化（必要性が出た場合）

## 3. 技術方針

- **フロントエンド:** React / Next.js（PWA対応を前提）
- **エディタ:** TipTap または Slate（Markdown出力 + GUI操作）
- **認証/権限:** ログインはGitHub OAuth（NextAuthを使用）、リポジトリアクセスはGitHub App（Drive導入時はGoogle OAuth追加）
- **バックエンド:** GitHub App Installation Tokenでファイル更新を行うサーバー（API Routes / Server Actions想定）
- **永続ストレージ:** ユーザー設定・メタ情報はDB、本文はGitリポジトリが正
- **インフラ:** Vercel + Supabase（Postgres）
- **ジョブ処理:** MVPは同期実行、必要に応じてキュー/ワーカーを追加

## 4. データモデル（改訂版）

### 4.1 User（ユーザー）
- **id:** uuid（主キー）
- **github_user_id:** bigint（GitHubユーザーID）
- **email:** text
- **name:** text
- **avatar_url:** text
- **created_at, updated_at:** timestamptz

### 4.2 RepoConnection（リポジトリ接続）
- **id:** uuid（主キー）
- **user_id:** uuid（外部キー → users）
- **provider:** text（'github'）
- **repo_full_name:** text（例: 'YusukeImai797/General'）
- **default_branch:** text（例: 'main'）
- **base_path:** text（例: 'notes'）
- **github_installation_id:** bigint
- **status:** text（'active' | 'inactive'）
- **created_at, updated_at:** timestamptz

### 4.3 TagMapping（ラベル→パスマッピング）**【新規】**
- **id:** uuid（主キー）
- **user_id:** uuid（外部キー → users）
- **repo_connection_id:** uuid（外部キー → repo_connections）
- **tag_name:** text（ラベル名）
- **target_path:** text（保存先パス）
- **color:** text（ラベル色、例: '#4913EC'）
- **description:** text（説明）
- **is_default:** boolean（デフォルトラベルか）
- **github_label_id:** bigint（GitHub LabelのID）
- **github_synced:** boolean（GitHub同期済みか）
- **last_synced_at:** timestamptz（最終同期時刻）
- **sync_status:** text（'synced' | 'pending' | 'conflict'）
- **created_at, updated_at, deleted_at:** timestamptz

### 4.4 Note（ノート）
- **id:** uuid（主キー）
- **user_id:** uuid（外部キー → users）
- **repo_connection_id:** uuid（外部キー → repo_connections）
- **tag_mapping_id:** uuid（外部キー → tag_mappings、オプション）
- **title:** text
- **path:** text（Gitリポジトリ内のパス）
- **tags:** text[]（配列）
- **word_count:** integer
- **last_commit_sha:** text
- **status:** text（'draft' | 'synced' | 'syncing' | 'conflict'）
- **created_at, updated_at:** timestamptz

### 4.5 SyncJob（同期ジョブ）
- **id:** uuid（主キー）
- **note_id:** uuid（外部キー → notes）
- **state:** text（'pending' | 'running' | 'completed' | 'failed'）
- **error_message:** text
- **created_at, updated_at:** timestamptz

### 4.6 LabelSyncLog（ラベル同期ログ）**【新規】**
- **id:** uuid（主キー）
- **tag_mapping_id:** uuid（外部キー → tag_mappings）
- **action:** text（'created' | 'updated' | 'deleted'）
- **source:** text（'github' | 'app'）
- **old_value, new_value:** jsonb
- **synced_at:** timestamptz

## 5. 保存・同期仕様

### 5.1 ローカル保存
- 入力は即時にローカルへ保存（IndexedDB / localStorage）
- ネットワークが切断されていても書き続けられる

### 5.2 リモート保存
- 30秒の無操作 or 「Done」操作でGitへ自動コミット
- バックグラウンドで実行、ユーザーを待たせない

### 5.3 保存先ルール（ラベルベース）
- **ラベルなし:** `<base_path>/` 直下に保存（例: `notes/untitled-note.md`）
- **ラベルあり（マッピング設定済み）:** マッピングされたパスに保存
  - 例: ラベル「01_Project」→ `01_Project/notes/my-note.md`
- **ラベルあり（マッピングなし）:** デフォルトパスに保存
  - 例: ラベル「work」→ `notes/work/my-note.md`

### 5.4 ラベル管理システム
- **GitHub Labelsとの双方向同期:**
  - 初回接続時: GitHub Labelsをインポート、パスマッピングを設定
  - アプリでラベル作成: 自動的にGitHubにも作成
  - GitHubでラベル変更: Webhook経由でアプリに反映（Phase 2）
  - マルチデバイス対応: GitHub経由で同期される

- **ラベル→パスマッピング:**
  - ユーザーは各ラベルに保存先パスを設定可能
  - 既存のプロジェクト構造に対応（例: `ProjectName/notes/`）
  - マッピング情報は `tag_mappings` テーブルで管理

- **ラベル操作:**
  - エディタから即座に新規ラベル作成可能（[+]ボタン）
  - 設定画面でラベルの追加・編集・削除
  - ラベル名変更時の既存ノート更新（オプション）

### 5.5 ファイル形式
- **Markdown + YAML Front Matter:**
  ```yaml
  ---
  title: "ノートのタイトル"
  tags: ["work", "meeting"]
  created_at: "2026-01-12T10:30:00Z"
  updated_at: "2026-01-12T15:45:00Z"
  note_id: "uuid-here"
  ---

  # ノートの本文
  ```

### 5.6 競合対応
- 更新時SHAが一致しない場合は `filename.conflict-YYYYMMDD.md` を生成
- UIに競合を表示し、ユーザーが手動でマージ

## 6. 主要画面と機能詳細（モック準拠）

### ① ログイン (Login)
- GitHubでログイン（モックのGoogleボタンはGitHub版に差し替え）
- 利用目的（設定同期 / Git連携）を簡潔に表示

### ② エディタ (Editor)
- **即時起動:** 最終編集の続き or 新規ドラフトを即表示
- **タグチップ:** 画面上部でタグを選択（保存先パスを内部で決定）
- **自動保存:** 明示的な保存ボタンなし。「Done」は画面遷移のみ
- **ツールバー:** 太字 / 斜体 / リスト / チェック / 画像 / リンク（モック準拠）

### ③ ライブラリ (Library)
- **Inbox:** 未分類のノートを最上部に表示
- **検索:** タイトル / タグ / 直近更新を対象に簡易検索
- **ステータス表示:** 同期済み / 同期中 / 競合をアイコンで可視化

### ④ 設定 (Settings / Repository Setup)
- **接続情報:** リポジトリURL / Branch / Base Folder
- **Drive連携:** 後続フェーズで実装（UIは非活性 or Coming Soon）

## 7. UI/UX指針（モック準拠）

- **テーマカラー:** `#4913EC`
- **背景:** `#F6F6F8`（ライト）、`#151022`（ダーク）
- **フォント:** Manrope + Noto Sans JP
- **ナビゲーション:** モバイルはボトムナビ、デスクトップは3ペイン
- **アニメーション:** 0.2s程度の軽いフェード / スライド

## 8. 実装計画（MVP）

1. **認証とリポジトリ接続**
   - GitHub OAuthログイン、GitHub App作成/インストール、接続情報の保存
2. **エディタの基盤**
   - エディタライブラリの導入、ローカル自動保存、タグ選択UI
3. **Git保存フロー**
   - GitHub APIによる作成/更新、コミットメッセージ設計、SHA競合判定
4. **ライブラリ画面**
   - 一覧表示、簡易検索、同期ステータスの可視化
5. **品質調整**
   - パフォーマンス、PWA対応、基本的なエラーハンドリング

## 9. GitHub App設定（ローカル開発）

- **ローカルURL:** `http://localhost:3000`
- **Repository permissions:**
  - Contents: Read & Write
  - Metadata: Read
- **Webhook:** MVPは無効で開始（後で有効化する場合は `push` のみ）
- **作成時に取得する値:**
  - App ID
  - Client ID / Client Secret
  - Private Key (PEM)
  - Webhook Secret（Webhookを使う場合）
- **環境変数（予定）:**
  - `GITHUB_APP_ID`
  - `GITHUB_APP_CLIENT_ID`
  - `GITHUB_APP_CLIENT_SECRET`
  - `GITHUB_APP_PRIVATE_KEY`
  - `GITHUB_APP_INSTALLATION_ID`
  - `GITHUB_OAUTH_CLIENT_ID`
  - `GITHUB_OAUTH_CLIENT_SECRET`
  - `GITHUB_WEBHOOK_SECRET`（使用時のみ）

## 10. バックエンドAPI設計（改訂版）

### 10.1 認証/接続フロー

- **GET `/api/auth/github`**
  - GitHub OAuthログイン開始（ユーザー識別）
- **GET `/api/auth/callback/github`**
  - OAuthコールバック、User作成/更新、セッション確立
- **GET `/api/github/repos`**
  - GitHub Appでアクセス可能なリポジトリ一覧を取得

### 10.2 リポジトリ設定

- **POST `/api/repos/connect`**
  - body: `repo_full_name`, `default_branch`, `base_path`
  - App Installation Token で検証し、RepoConnectionを保存
- **GET `/api/repos/current`**
  - 現在接続中のリポジトリ情報を返す

### 10.3 ラベル管理（新規）

- **GET `/api/labels`**
  - 現在のラベル一覧を取得（tag_mappingsから）
- **GET `/api/labels/github`**
  - GitHub Labelsを取得（Issues API経由）
- **POST `/api/labels`**
  - 新規ラベル作成（自動的にGitHubにも作成）
  - body: `tag_name`, `color`, `description`, `target_path`
- **PUT `/api/labels/:id`**
  - ラベル更新（GitHubにも反映）
- **DELETE `/api/labels/:id`**
  - ラベル削除（ソフトデリート、GitHubは残す）
- **POST `/api/labels/sync`**
  - GitHub Labelsと手動同期
- **POST `/api/labels/:id/push`**
  - 特定ラベルをGitHubにプッシュ

### 10.4 ノート操作

- **GET `/api/notes`**
  - query: `q`, `tag`, `limit`, `cursor`
  - Noteメタ情報の一覧を返す
- **GET `/api/notes/:id`**
  - Noteメタ + GitHubから本文を取得
- **POST `/api/notes`**
  - 新規ノート作成（本文とメタ）
  - ラベルに基づいて保存先パスを自動決定
- **PUT `/api/notes/:id`**
  - 本文更新（自動保存用）
- **POST `/api/notes/:id/sync`**
  - GitHubへのコミット実行（SHA競合時はconflict扱い）

### 10.5 Webhook（Phase 2）

- **POST `/api/webhooks/github`**
  - GitHub Webhook受信エンドポイント
  - イベント: `label` (created, edited, deleted)
  - 署名検証後、tag_mappingsを自動更新

### 10.6 レスポンス形式

- **成功:**
  ```json
  {
    "status": "success",
    "data": { ... }
  }
  ```
- **同期状態:**
  ```json
  {
    "sync_status": "synced" | "pending" | "conflict" | "error",
    "last_synced_at": "2026-01-12T10:30:00Z"
  }
  ```
- **エラー:**
  ```json
  {
    "error": "エラーメッセージ",
    "code": "ERROR_CODE"
  }
  ```

## 11. Supabaseスキーマ（MVP）

- **SQLファイル:** `Plan/supabase_schema.sql`
- **実行場所:** Supabaseの SQL Editor
- **実行方法:** そのまま貼り付けて実行（再実行しても安全）
- **RLS:** MVPはバックエンド経由のみのため無効のまま進める

## 12. 設計決定事項（2026-01-12更新）

### 12.1 ラベルベースの保存先管理
- ✅ GitHub Labelsを活用したラベル管理
- ✅ ラベル→パスマッピング機能（tag_mappingsテーブル）
- ✅ 双方向同期（アプリ ⇔ GitHub）
- ✅ 既存プロジェクト構造への対応（例: `ProjectName/notes/`）

### 12.2 同期方針
- ✅ Phase 1: アプリ→GitHub即座同期、GitHub→アプリはポーリング
- ✅ Phase 2: GitHub Webhook導入で完全リアルタイム同期

### 12.3 未決事項
- エディタライブラリの最終選定（TipTap / Slate）→ TipTap推奨
- ジョブ処理（キュー/ワーカー）の導入タイミング → Phase 3以降
- GitHub Appの本番URL（Vercelドメイン確定後に設定）

## 13. 進捗メモ（2026-01-11）

### 完了
- GitHub App / GitHub OAuth App を作成済み
- `.env.local` に各種キーを反映（`Y:\Apps\Gitnote\app\.env.local`）
- GitHub AppのPEMは `.secrets` に保管（Git管理外）
- Supabaseのスキーマ作成用SQLを用意し、SQL Editorで実行済み
- Next.js (TS) + NextAuth を導入し、`/api/auth/[...nextauth]` まで実装済み
- サインイン/サインアウト用の簡易UIをトップページに作成済み

### 未完了/要確認
- `Continue with GitHub` クリック時の遷移が発生しない
  - `NEXTAUTH_URL` と実際の起動ポートの不一致が疑わしい
  - `/api/auth/providers` が正常に返るか確認が必要
- 3000番ポートが他プロセスで使用される場合がある
  - 3000で起動できない場合は `NEXTAUTH_URL` と OAuth Callback を合わせて更新

### 次回の確認手順
- 開発サーバーを `http://localhost:3000` で起動
- `http://localhost:3000/api/auth/providers` を開いてレスポンス確認
- `NEXTAUTH_URL` の値と起動ポートの一致を確認

## 14. 引き継ぎ事項（次回セッション用）

### プロジェクト前提
- 開発ルート: `Y:\Apps\Gitnote`
- Next.js アプリ: `Y:\Apps\Gitnote\app`
- Plan/設計資料: `Y:\Apps\Gitnote\Plan`
- `.env.local` の場所: `Y:\Apps\Gitnote\app\.env.local`
- 秘密情報: `Y:\Apps\Gitnote\.secrets`（PEM等はGit管理外）

### 重要な決定事項
- 認証: GitHub OAuth（NextAuth）
- リポジトリ操作: GitHub App
- DB: Supabase（Postgres）
- ホスティング: Vercel予定

### 現在の状態（2026-01-12 更新）
- ✅ 認証システム実装完了（GitHub OAuth + NextAuth）
- ✅ GitHub App連携実装完了
- ✅ リポジトリ接続API実装完了（/api/repos/connect, /api/github/repos）
- ✅ GitHub App Private Key修正完了（エンコーディング問題解決）
- ✅ リポジトリリスト取得成功
- ✅ /connect ページでリポジトリ選択可能
- ✅ 開発サーバー正常動作中（http://localhost:3000）

### 完了した課題
- ✅ GitHub App秘密鍵のエンコーディング問題（`\\n` → `\n`）
- ✅ リポジトリリストが表示されない問題
- ✅ サーバーハング問題（.nextキャッシュクリア）

### 次のステップ
1. **Phase 1完了**: リポジトリ接続機能の完成
   - Connect Repositoryボタンの動作確認
   - repo_connectionsテーブルへの保存確認

2. **Phase 2開始**: ラベルインポート機能
   - tag_mappingsテーブル作成
   - /api/labels/github 実装
   - ラベルインポートUI実装
