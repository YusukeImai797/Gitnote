# Gitnote - Vercel デプロイガイド

このガイドでは、GitnoteをVercelに無料デプロイする手順を説明します。

## 前提条件

- GitHubアカウント
- Gitnoteリポジトリ（このコード）がGitHubにプッシュされていること

## ステップ1: Vercelアカウント作成

1. https://vercel.com にアクセス
2. **"Sign Up"** をクリック
3. **"Continue with GitHub"** を選択
4. GitHubアカウントでログイン
5. プランは **"Hobby"（無料）** を選択

## ステップ2: プロジェクトのインポート

### 方法A: Vercel Web UI（推奨）

1. Vercelダッシュボードで **"Add New Project"** をクリック
2. **"Import Git Repository"** を選択
3. GitHubリポジトリ一覧から **Gitnote** を選択
4. **"Import"** をクリック

### プロジェクト設定

- **Framework Preset**: Next.js（自動検出されるはず）
- **Root Directory**: `app`（重要！）
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

**重要**: Root Directoryを `app` に設定してください（プロジェクトルートではなく）

## ステップ3: 環境変数の設定

Vercelプロジェクト設定で、以下の環境変数を追加します：

### 必須の環境変数

| 変数名 | 値 | 説明 |
|--------|-----|------|
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | デプロイ後のURLに置き換える |
| `NEXTAUTH_SECRET` | `988d08bafc9e5886e617a6de57de25ebcd15af796e5f87ad1405116330a91902` | 既存の値を使用 |
| `GITHUB_APP_ID` | `2635609` | GitHub App ID |
| `GITHUB_APP_CLIENT_ID` | `Iv23lio1gU27c1EFp7gv` | GitHub App Client ID |
| `GITHUB_APP_CLIENT_SECRET` | `08651fc83066bf290ad6c68605865f11882757e2` | GitHub App Client Secret |
| `GITHUB_APP_PRIVATE_KEY` | (下記参照) | GitHub App Private Key |
| `GITHUB_OAUTH_CLIENT_ID` | `Ov23liluvwcAwLDjMdAM` | GitHub OAuth Client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | `f15e5b8f344b4a9634b930e37dc7230270df29ee` | GitHub OAuth Client Secret |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://mgempnhcwuybuqvvvdpn.supabase.co` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (下記参照) | Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | (下記参照) | Supabase Service Role Key |

### GITHUB_APP_PRIVATE_KEY の設定

Private Keyは改行を含むため、以下の形式で設定します：

```
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAtnsvFYP0D0NkEySfbJ8rJEJE/t0TgAhyStgGA++i+IUAtMBs
WoHe2i5xgqk1taqgutPQ7F0MyioYw4aVWcthoz9nEdRgvx4EpYs+ZqaAgZ7imJ0c
bbR9EhBdqzwDhy0Gmx1hP4/sx8i2KoPlGP3WoQs/cIBNej++rtvWYP5txXt6eFE+
6wS21MSRk/LZ1d49mc4f6psj8iYycqtPQL/EexWA1r8WkeS8jbRbIryvHTdwduxt
gh4MskEVsga+ESSjntz7ChuNuqRJlDcsL+RYCrXGC9B1o5Kb1y6pkrJp17GttDOE
0QNraGsm0yJw+pan4ywzxCWzpObCOV6RuEA+SwIDAQABAoIBABAB7FZx1dYE7mFz
g/yuVcV/frfwwsYnd4czPgvYWK5+VFqGyrqBy//NtS1mFI0UI7df32LsorOVT8jP
JIjU+4KrjCoXPElno7a16Upt7rXwLyZ+GcFR5OrRvrXHtPOFsp+myyIdSQMZi0ld
eppfohVMfEstJh7EOsDyDfNCPnTlQvZNi/zNKlNps/ufJHopAbs41xG7lz0KNuv3
tVLSZhR6Uc4Ui3dA4WOmgrx9INpc+1PhYJDe47IKkHRL5CZRlUT37O5khQPg9m0E
xvtPmvy1Yj+ahp2sQGKcESkjri6QZPZh9k4vXJ85BiAIfuJox9lUiUzdtoYExNE/
bofXTEECgYEA7kRiNqPpb61iZoXwPpNrVRKZ0RaClgS5/qXEBIMmY4yqSjr184iK
5kLRiyyA5yT4Ps9w8QilGXMOZIvXyjzIHDYglPzvjMn/sUYEzEfT6r4313I9vRC3
IUbZPRJoEtYY8UixfMQrqoUdj8uaeYPUOx4P+D92YAj5dzqdGtfx6+sCgYEAxA/u
ZV+XSXGRfEMVcCQ8f4R2a9YSAoWmF6ZQGfUM+0aoj/Ye1PDYI3umdSqPywU2WKsO
0H2X6uDffSUZbMMj80eNg3ilX3VXgDdBSsBF8CgvEn3Ak5r3tTce+Xjn04tYXhJo
ZXdqqjJFBlm/2tXvE5KNWpT7aP7E9N/XVpSGPyECgYBb7wjSOmaMz6KjGlT7YBhO
5/FvqrbSOZqmdcFvWEdMq+7c22khAXNOq0N85rwJ88rROWtDpWlGq41HIGovv0ob
EIt70SiA80P0W6boR2KuNZ0IRS0rMTLn5RVXKi377p4LI1hQYsTSc7BXVmERN9uA
v/W7fIkpPu06ouQRgnb25wKBgQCsyxmhEFlGKig9auYW+mizPewcaANhY6aZS0Nn
TRhO0Nw4XIKZy1XCF/UBaCxokkRuavvYdggQwnVVVwAMYgNqIpKu3wJomgMvBgOu
PLymxtONqXSy4i4T8OuElLFEOJf9+J03Z8KDE2DQEwNKe6eECXI49fqJc5fj9O9U
5/tU4QKBgCn/svvmekfkCKY1YZCIlsACV5kl1gET0Jyi+3uRCnEjP1fK5oy5EwaL
mkrUnezZgaIuf2OIw/YRWmkMTfkdcf9KO2neazyMl0PcpcaeOdX5y7Bp/97D0b22
r5BOXAn7CFB/k9QYIZ2EQ8PK2IMKy/ilLsd5UpEyodR5UMNvtgze
-----END RSA PRIVATE KEY-----
```

**重要**: Vercelでは改行が自動的に処理されます。上記のテキストをそのままコピー&ペーストしてください。

### Supabase Keys

- **NEXT_PUBLIC_SUPABASE_ANON_KEY**:
  ```
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZW1wbmhjd3V5YnVxdnZ2ZHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMjIwMDgsImV4cCI6MjA4MzY5ODAwOH0.M_R9bfyapXgPPH-xp7TQedhCEqwTNXsUxS2hAvalLg4
  ```

- **SUPABASE_SERVICE_ROLE_KEY**:
  ```
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZW1wbmhjd3V5YnVxdnZ2ZHBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODEyMjAwOCwiZXhwIjoyMDgzNjk4MDA4fQ.vB5kc8d-QhfxJLmKeQMxIPF-qeAteUn6U0HXA_jF4so
  ```

## ステップ4: デプロイ実行

1. 環境変数をすべて設定したら **"Deploy"** をクリック
2. ビルドが完了するまで待機（通常2-5分）
3. デプロイが成功すると、URLが表示されます（例: `https://gitnote-xxxx.vercel.app`）

## ステップ5: GitHub App設定の更新

デプロイ後、GitHub App の Callback URL を更新する必要があります。

1. https://github.com/settings/apps にアクセス
2. あなたのGitHub Appを選択
3. **General** タブで以下を更新：
   - **Homepage URL**: `https://your-app.vercel.app`
   - **Callback URL**: `https://your-app.vercel.app/api/github/app/callback`
   - **Setup URL**: `https://your-app.vercel.app/api/github/app/install`
4. **Save changes** をクリック

### GitHub OAuth App設定の更新

1. https://github.com/settings/developers にアクセス
2. OAuth Appsタブを選択
3. あなたのOAuth Appを選択
4. 以下を更新：
   - **Homepage URL**: `https://your-app.vercel.app`
   - **Authorization callback URL**: `https://your-app.vercel.app/api/auth/callback/github`
5. **Update application** をクリック

## ステップ6: NEXTAUTH_URL の更新

1. Vercelダッシュボードに戻る
2. **Settings** → **Environment Variables** を開く
3. `NEXTAUTH_URL` を見つけて **Edit** をクリック
4. 値を実際のデプロイURLに変更（例: `https://gitnote-xxxx.vercel.app`）
5. **Save** をクリック
6. **Redeploy** をクリックして再デプロイ

## ステップ7: 動作確認

デプロイされたURLにアクセスして、以下を確認：

1. ✅ ページが正常に表示される
2. ✅ GitHub でログインできる
3. ✅ リポジトリ接続ができる
4. ✅ ノートの作成・編集・保存ができる
5. ✅ PWAとしてインストールできる（モバイル）
6. ✅ オフラインページが表示される（Network → Offline）

## トラブルシューティング

### ビルドエラー: "Cannot find module"
- Root Directoryが `app` に設定されているか確認

### 認証エラー: "NEXTAUTH_URL mismatch"
- `NEXTAUTH_URL` が実際のデプロイURLと一致しているか確認
- 再デプロイが必要な場合があります

### GitHub App connection failed
- GitHub App の Callback URL が正しく設定されているか確認
- `https://your-app.vercel.app/api/github/app/callback` 形式になっているか

### Supabase connection error
- 環境変数 `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が正しく設定されているか
- プレフィックス `NEXT_PUBLIC_` が付いているか確認

## 無料プランの制限

Vercel Hobby（無料）プランの制限：
- ✅ 無制限のデプロイ
- ✅ 100GB帯域幅/月
- ✅ カスタムドメイン対応
- ✅ 自動HTTPS
- ⚠️ 商用利用は不可（個人利用のみ）

## 次のステップ

1. カスタムドメインの設定（オプション）
2. アナリティクスの有効化（オプション）
3. モバイルでPWAインストールのテスト

---

デプロイに関する質問があれば、お気軽にお尋ねください！
