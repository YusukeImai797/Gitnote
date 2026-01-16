# 製品仕様書：Gitnote - Stress-Free Markdown Editor (Git Sync)

## 0. 改定メモ

- **v1.2 (2026-01-13):**
    - **アーキテクチャ刷新:** "ID-First Architecture" を採用。ノート作成時に即座にDB IDを発行し、GitHubパスに依存しないデータ管理を実現。
    - **データ保護:** IndexedDB (Dexie.js) を導入し、オフライン・ネットワーク不安定時のデータ消失を防止。
    - **ファイル管理機能:** ライブラリ画面に一括操作（削除・移動・ラベル）を追加。
    - **エッジケース対応:** 削除済みノートへのアクセス時の自動復旧フロー、移動時の同一フォルダ検知などを実装。

- **v1.1 (2026-01-12):** UI/UX全面刷新、フォルダエイリアス機能追加。
- **v1.0 (2026-01-08):** 初版作成。

## 1. プロジェクト概要

「思いついた時にストレスなく書き、それがGitを通じて資産として残る」ことを目的としたWebベースのマークダウンエディタ。

- **ターゲット:** MarkdownやGitに詳しくないが、情報を構造的に残したいユーザー
- **プラットフォーム:** Webアプリ（モバイル最優先、レスポンシブ）
- **主要体験:** 起動即エディタ、自動保存、タグ/フォルダベースの整理

## 2. スコープ定義

### MVP (Current Phase)
- **認証:** GitHub OAuth + GitHub App 連携
- **エディタ:**
    - ID-Firstによる即時編集開始
    - IndexedDBによる堅牢な自動保存
    - GitHubへのバックグラウンド同期
- **ファイル管理:**
    - ライブラリでの一覧表示・検索・フィルタリング
    - 一括操作（削除・移動・ラベル編集）
    - フォルダ構造の概念維持（DB上の`folder_path_id`管理）

### Future Phases
- Google Drive同期
- 複数リポジトリのスマート切り替え
- 共同編集 / コメント体系

## 3. 技術方針

- **フロントエンド:** Next.js 16 (App Router), React, Tailwind CSS v4
- **エディタ:** TipTap (Headless WYSIWYG for Markdown)
- **状態管理:** React State + SWR/TanStack Query (予定)
- **ローカルストレージ:** **Dexie.js (IndexedDB wrapper)** - オフライン編集とキャッシュの主役
- **バックエンド:** Next.js API Routes (Serverless)
- **データベース:** Supabase (PostgreSQL) - メタデータおよびドラフト/キャッシュの永続化
- **Git連携:** GitHub API (Octokit) - "Source of Truth"としてのファイル実体

## 4. データモデル（実装反映版）

### 4.1 User
- `id`, `email`, `name`, `avatar_url`, `github_user_id`

### 4.2 RepoConnection
- `id`, `user_id`, `repo_full_name`, `default_branch`, `base_path`, `github_installation_id`

### 4.3 FolderPath
- `id`, `user_id`, `repo_connection_id`, `path` (e.g. "notes/work/"), `alias` (e.g. "Work Notes")

### 4.4 Note (Updated)
- `id`: uuid (Primary Key)
- `user_id`: uuid
- `repo_connection_id`: uuid
- `folder_path_id`: uuid (現在の所属フォルダ参照)
- `title`: text (デフォルト "Untitled Note")
- `content`: text (DBキャッシュ、検索・高速表示用)
- `path`: text (Git上のファイルパス, e.g. "notes/2024/doc.md")
- `tags`: text[]
- `last_commit_sha`: text (GitHub同期状態管理用)
- `status`: 'synced' | 'draft' | 'conflict' | 'error'
- `created_at`, `updated_at`

### 4.5 Label (TagMapping)
- `id`, `tag_name`, `color`, `target_path` (このタグが付いた時のデフォルト保存先)

## 5. 保存・同期仕様（ID-First Architecture）

### 5.1 作成フロー (Create Draft)
1. ユーザーが「New Note」を押下（または対象ノートなしでアクセス）
2. API `POST /api/notes/create-draft` をコール
3. **DB:** `notes` テーブルにレコード作成（UUID発行）、タイトル "Untitled Note"
4. **GitHub:** 即座に空ファイル（Frontmatterのみ）を作成し、パスを確定
    - これにより、初回保存時のラグや「ファイル名未定」状態での同期ズレを防ぐ。
5. クライアントはUUIDを受け取り、IndexedDBに初期データを保存して編集開始。

### 5.2 編集・保存フロー
1. **入力:** TipTapエディタで入力イベント発生。
2. **ローカル保存 (IndexedDB):** 1秒デバウンスで Dexie.js に保存。
    - ユーザーはネットワーク状態に関わらず安全に編集継続可能。
    - タブを閉じても次回ロード時にここから復元。
3. **クラウド同期 (GitHub + DB):** 30秒デバウンス または 「Done/Sync」ボタン押下。
    - API `PUT /api/notes/:id` をコール。
    - DB: `content`, `title`, `tags` を更新。
    - GitHub: `createOrUpdateFileContents` でコミット。
    - 成功時: `last_commit_sha` を更新し、ステータスを `synced` に。

### 5.3 競合・エッジケース対応

#### コンフリクト (Conflict)
- **検知:** `last_commit_sha` とGitHub上の最新SHAが不一致の場合。
- **挙動:** APIは `409 Conflict` を返し、ステータスを `conflict` に更新。
- **UI:** エディタヘッダーに「競合が発生しました」と表示。
- **解決策 (Planned):**
    1. **強制上書き:** ユーザーが自身のバージョンを正としてプッシュ（Force push的な挙動）。
    2. **別名保存:** `filename-conflict-TIMESTAMP.md` として別ファイル化。

#### 移動 (Move)
- Folder IDを変更し、API `PUT /api/notes/batch/move` をコール。
- **GitHub:** 旧パスのファイルを削除 → 新パスにファイルを作成（`git mv` 相当）。
- **DB:** `path` と `folder_path_id` を更新。
- **同名ファイル対策:** 移動先に同名ファイルが存在する場合、移動をスキップしてユーザーに通知するか、自動リネームを行う（現状はスキップ実装）。

#### 削除 (Delete)
- **一括削除:** DBレコード削除 AND GitHubファイル削除。
- **削除済みノートへのアクセス:** URL直打ちやキャッシュ等でアクセスした場合、`404 Note Found` を検知し、自動的に `localStorage` の履歴をクリアして「新規ドラフト」画面へリダイレクト（ユーザーを迷子にさせない）。

## 6. 主要画面と機能

### ① エディタ (Editor)
- **ID-First:** UUIDベースのルーティング (`/editor?id=...`)
- **Sync Status:** 緑チェック（同期完了）、スピナー（同期中）、赤アラート（エラー/競合）
- **Tag Selector:** 直感的なタグ付けUI

### ② ライブラリ (Library)
- **表示モード:** グリッド / リスト
- **選択モード:** 長押し/右クリックで起動。複数選択可能。
- **アクションバー:**
  - **移動:** フォルダ選択モーダルで一括移動。
  - **ラベル:** ラベル追加/削除のバッチ処理。
  - **削除:** 一括削除（確認ダイアログ付き）。

### ③ 設定 (Settings)
- リポジトリ接続管理
- ラベル管理（GitHub Labels同期）
- フォルダエイリアス設定

## 7. 実装計画（残課題 & 整合性チェック）

### 7.1 整合性チェックとギャップ分析 (2026-01-13)

現在のMVP実装において、"Stress-Free" UXを実現する上での既知のギャップと対応方針を定義する。

#### A. オフライン新規作成の制限 (Gap: High)
- **現状:** ID-First ArchitectureはサーバーサイドでのUUID発行に依存しているため、**完全オフライン状態では新規ノートを作成できない**。
- **影響:** オフラインでアプリを開いた際、既存ノートの編集は可能だが「思いつきを即座に書き留める（新規作成）」ことができない。
- **対策方針 (Phase 3):** クライアントサイドUUID生成への移行。
  - `crypto.randomUUID()` でクライアントIDを仮発行。
  - オフライン時は `temp_id` でIndexedDBに保存。
  - オンライン復帰時にサーバーへ同期し、正式IDと紐付ける（またはそのまま使用する）。

#### B. コンフリクト解決のUX (Gap: Medium)
- **現状:** 同一ファイルを複数端末で編集した場合、後勝ちではなく `409 Conflict` エラーとなり、保存がブロックされる。
- **影響:** ユーザーはエラー表示を見るだけで、UI上から解決策（強制上書きや別名保存）を選べないため、手動でテキストを退避してリロードする等の手間が発生する。
- **対策方針 (Phase 3):** コンフリクト解決UIの実装。
  - ヘッダーに「強制的に上書き」または「コピーを保存」ボタンを表示。

#### C. 移動中の同時編集 (Gap: Low)
- **現状:** ライブラリでノート移動中にエディタで編集していた場合、パス変更により一時的に保存が失敗する可能性がある。
- **対策:** エディタ側でパス変更を検知し、保存先を自動追従するロジックは実装済みだが、厳密なレースコンディション（移動直後の保存）ではエラーの可能性がある。

### 7.2 Phase 3: 品質向上・堅牢化 (Next Priority)
1. **クライアントサイドID生成:** オフライン新規作成の実現。
2. **コンフリクト解決UI:** コンフリクト時の「強制上書き」「別名保存」選択肢の実装。
3. **エラーハンドリング強化:** ネットワークエラー時のリトライ機構（SWR等の導入検討）。
4. **オフラインページ:** 本格的なオフライン対応（Service Workerキャッシュ戦略の調整）。

### Phase 4: 機能拡張
1. **高度な検索:** 全文検索の実装（Postgres Full Text Search）。
2. **画像アップロード:** GitHubへの画像保存フローの最適化。

## 8. API エンドポイント一覧（実装済み）

- `GET /api/notes`: ノート一覧取得
- `GET /api/notes/:id`: ノート詳細取得（DBメタデータ + GitHub本文）
- `PUT /api/notes/:id`: ノート更新（DB + GitHub）
- `POST /api/notes/create-draft`: 新規ノート作成（ID発行 + GitHub空ファイル作成）
- `DELETE /api/notes/batch`: [NEW] ノート一括削除
- `PUT /api/notes/batch/move`: [NEW] ノート一括移動
- `PUT /api/notes/batch/labels`: [NEW] ノート一括ラベル操作
- `GET /api/folders`: フォルダ一覧取得

## 9. データベーススキーマ（Supabase）

`app/supabase/migration_id_first.sql` に最新のマイグレーション定義あり。
既存の `drafts` テーブルは廃止され、`notes` テーブルに統合。
