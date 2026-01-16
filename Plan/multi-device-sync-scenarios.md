# マルチデバイス同期シナリオ分析

## 現在の実装状況

### 同期の基本メカニズム
- **IndexedDB**: ローカルキャッシュ（`updatedAt`, `syncedAt` を記録）
- **Supabase**: クラウドDB（`updated_at` を記録）
- **GitHub**: 永続ストレージ（Git sync時のみ更新）

### 現在のタイムスタンプの意味
- `localNote.updatedAt`: ローカルで最後に編集した時刻
- `localNote.syncedAt`: 最後に同期したサーバーの `updated_at`
- `serverUpdatedAt`: サーバーの `updated_at`

### 判定ロジック
- `cacheIsStale = syncedAt < serverUpdatedAt`
- `hasLocalEdits = updatedAt > syncedAt`

---

## シナリオ一覧

### ✅ 対応済みシナリオ

#### S1: 単一デバイスでの通常編集
- デバイスAで編集 → 3秒後にクラウド保存 → `syncedAt` 更新
- **結果**: 正常動作

#### S2: デバイス切り替え（ローカル編集なし）
- デバイスAで編集・保存 → デバイスBで開く
- デバイスBの `syncedAt < serverUpdatedAt` かつ `hasLocalEdits = false`
- **結果**: サーバーの内容を表示 ✅

#### S3: デバイス切り替え（ローカル編集あり）
- デバイスAで編集途中で離脱 → デバイスBで開く → デバイスAに戻る
- デバイスAの `hasLocalEdits = true`
- **結果**: ローカルの編集を保持 ✅

#### S4: 両デバイスでエディタ開いたまま片方で編集
- デバイスAとBでエディタ開く → デバイスAで編集 → デバイスBをフォアグラウンドに
- visibility changeでサーバーチェック → サーバー版に更新
- **結果**: 自動更新 ✅

---

### ⚠️ 検討が必要なシナリオ

#### S5: オフライン編集後のオンライン復帰
- デバイスAでオフライン編集 → オンライン復帰
- 問題: オフライン中は `saveToCloud` が呼ばれない → `syncedAt` が更新されない
- 期待動作: オンライン復帰時に自動同期

#### S6: 両デバイスでオフライン編集
- デバイスAでオフライン編集 → デバイスBでもオフライン編集 → 両方オンラインに
- 問題: どちらの変更を優先するか
- 期待動作: コンフリクトUIを表示

#### S7: 長時間放置後の再開
- デバイスAで編集 → 数時間/数日放置 → デバイスAで再開
- ブラウザが再起動している可能性（IndexedDBは残る）
- 問題: `loadNote` が呼ばれるが、古い `syncedAt` のまま
- 期待動作: サーバーの最新版を取得

#### S8: 新規ノート作成の同期
- デバイスAで新規作成 → デバイスBで開く
- 問題: デバイスBのIndexedDBにはこのノートがない
- 期待動作: サーバーから取得（現在は対応済み）

#### S9: ノート削除の同期
- デバイスAでノート削除 → デバイスBで同じノートを開こうとする
- 問題: デバイスBのIndexedDBには残っている可能性
- 期待動作: 削除されたことを通知、新規作成へ誘導

#### S10: 同時編集（リアルタイム）
- デバイスAとBで同時に同じノートを編集
- 問題: 3秒ごとの保存で上書き合戦になる可能性
- 期待動作: 最後の変更を検出して警告

#### S11: ネットワーク切断中の保存
- 編集中にネットワークが切断
- 問題: `saveToCloud` が失敗、`syncedAt` が更新されない
- 期待動作: オフラインモードに移行、ローカル保存を継続

#### S12: ブラウザクラッシュ/強制終了
- 編集中にブラウザがクラッシュ
- 問題: `beforeunload` が呼ばれない可能性
- 期待動作: 1秒debounceのローカル保存が残っていれば復元

#### S13: タブを閉じて別タブで開く
- 同一デバイスでタブAで編集 → タブAを閉じる → タブBで同じノートを開く
- 問題: タブAの最後の編集が保存されているか
- 期待動作: ローカル保存が残っていれば復元

#### S14: 複数タブで同じノートを開く
- 同一デバイスでタブAとタブBで同じノートを開く
- 問題: 両方で編集すると競合
- 期待動作: 警告を表示、または最後の編集を優先

#### S15: saveToCloud失敗時のリトライ
- ネットワークエラーで `saveToCloud` が失敗
- 問題: `syncedAt` が更新されず、次回ロード時に古い版と判定される可能性
- 期待動作: リトライキューに入れ、成功するまで再試行

#### S16: サーバーとIndexedDBの不整合
- IndexedDBに古いデータが残っている状態でサーバーが更新された
- 問題: `syncedAt = 0` の初期状態でサーバーと比較
- 期待動作: 初回ロード時は常にサーバー優先

#### S17: 編集中のリロード/ナビゲーション
- 編集中にF5やブラウザバックでページを離れる
- 問題: `beforeunload` で保存を試みるが、非同期処理が完了しない可能性
- 期待動作: 可能な限りローカル保存、次回起動時に復元

#### S18: モバイルでのバックグラウンド制限
- モバイルブラウザがバックグラウンドタブを制限/停止
- 問題: `visibilitychange` が正しく発火しない可能性
- 期待動作: フォアグラウンド復帰時に状態チェック

#### S19: セッションタイムアウト
- 長時間放置でセッションが切れる
- 問題: APIリクエストが401で失敗
- 期待動作: 再認証を促す、ローカル保存は継続

#### S20: 大量のオフライン変更
- オフラインで複数ノートを編集
- 問題: オンライン復帰時に一括アップロードが必要
- 期待動作: バックグラウンドで順次同期

---

## 優先度と対応方針

### 高優先度（ユーザー体験に直接影響）

1. **S5: オフライン編集後のオンライン復帰**
   - 対応: `online` イベントで未同期データを自動アップロード

2. **S11: ネットワーク切断中の保存**
   - 対応: エラーハンドリング強化、オフラインキュー

3. **S10: 同時編集の競合検出**
   - 対応: visibility changeでの警告は実装済み、polling追加を検討

### 中優先度（エッジケース）

4. **S6: 両デバイスでオフライン編集**
   - 対応: コンフリクトUIの実装

5. **S14: 複数タブで同じノートを開く**
   - 対応: BroadcastChannel APIまたはlocalStorage eventで同期

### 低優先度（レアケース）

6. **S12: ブラウザクラッシュ**
   - 対応: 現在の1秒debounceで部分的にカバー

7. **S7: 長時間放置後の再開**
   - 対応: loadNote時のロジックでカバー済み

---

## 現在の実装の批判的分析

### 根本的な問題

1. **syncedAtの意味が曖昧**
   - 現在: 「サーバーの updated_at」を記録
   - しかし: `saveLocalNote` で `syncedAt` を保持しても、`updatedAt` は毎回更新される
   - 結果: `hasLocalEdits = updatedAt > syncedAt` が、実際に「編集した」かどうかではなく「ローカル保存した」かどうかを示す

2. **コンテンツベースの比較が不完全**
   - `contentDiffers` を計算しているが、判定ロジックでは `hasLocalEdits` を優先
   - 例: 同じ内容でもタイムスタンプが違えば「編集あり」と判定される可能性

3. **saveToCloud の暗黙的な動作**
   - 3秒debounceで自動保存
   - しかし失敗時のリトライがない
   - `syncedAt` が更新されないまま放置される可能性

### 提案: 判定ロジックの簡素化

現在のロジック（複雑）:
```
if (cacheIsStale && !hasLocalEdits) { useServer }
else if (hasLocalEdits && !cacheIsStale) { useLocal }
else if (hasLocalEdits && cacheIsStale) { conflict }
else { useServer }
```

提案するロジック（シンプル）:
```
if (!contentDiffers) {
  // 内容が同じなら常にサーバーを使用（タイムスタンプを最新に）
  useServer; markSynced();
} else if (cacheIsStale) {
  // サーバーが更新されていて、内容が違う = コンフリクト
  showConflictUI();
} else {
  // サーバーは古い、ローカルが新しい = ローカルを使用
  useLocal;
}
```

この方が直感的で、エッジケースが少ない。

---

## 実装プラン

### Phase 1: オフライン復帰時の自動同期（S5, S11対応）

**問題**: オンライン復帰時に未同期データがアップロードされない

**実装**:
```typescript
// handleOnline を強化
const handleOnline = async () => {
  setIsOnline(true);
  toast.success("オンラインに復帰しました");

  // 未同期のローカル変更があればアップロード
  if (note.id && hasUnsyncedChanges.current) {
    await saveToCloud();
  }
};
```

### Phase 2: 同時編集の検出強化（S10対応）

**問題**: 同時編集時に最後の保存が勝ち、警告なく上書きされる

**実装案A: Polling**
- 10秒ごとにサーバーの `updated_at` をチェック
- 自分の `syncedAt` より新しければ警告

**実装案B: サーバー側で楽観的ロック**
- PUTリクエストに `expected_updated_at` を含める
- サーバー側で不一致なら409を返す

**選択**: 実装案Aはシンプルだがバッテリー/帯域消費あり。実装案Bはより堅牢。
→ まず実装案Bを採用（saveToDbOnly時も楽観的ロック）

### Phase 3: 複数タブ検出（S14対応）

**問題**: 同一デバイスで複数タブで同じノートを開くと競合

**実装**:
```typescript
// BroadcastChannel APIで他タブと通信
const channel = new BroadcastChannel('gitnote-editor');

// 編集開始時に通知
channel.postMessage({ type: 'EDITING', noteId: note.id });

// 他タブからの通知を受信
channel.onmessage = (event) => {
  if (event.data.noteId === note.id) {
    toast.warning("別のタブでこのノートが編集されています");
  }
};
```

### Phase 4: コンフリクトUI強化（S6対応）

**問題**: 真のコンフリクト時にユーザーが選択できない

**実装**:
- コンフリクトモーダルを強化
- 「自分の変更を保持」「サーバー版を使用」「両方を表示して手動マージ」

### 実装優先順位

1. **Phase 0** - 判定ロジックの簡素化（根本対策）
2. **Phase 1** - オフライン復帰時の同期（影響大、実装簡単）
3. **Phase 2** - 楽観的ロック（競合防止の根本対策）
4. **Phase 3** - 複数タブ検出（ユーザー体験向上）
5. **Phase 4** - コンフリクトUI強化（最後の砦）

---

## 詳細実装プラン

### Phase 0: 判定ロジックの簡素化

**変更点**:
1. `loadNote` の判定を content-based に変更
2. `hasLocalEdits` の計算を削除（不要になる）
3. シンプルな3分岐: 同じ内容 / サーバーが新しい / ローカルが新しい

**コード**:
```typescript
if (!contentDiffers) {
  // 内容が同じ = サーバー版を使用、syncedAt を更新
  useLocal = false;
  await markNoteSynced(id, serverUpdatedAt);
} else if (cacheIsStale) {
  // サーバーが更新されていて、内容も違う = コンフリクト
  // ユーザーに選択させる
  showConflictModal = true;
} else {
  // サーバーは古い（または同じ）、内容が違う = ローカル優先
  useLocal = true;
}
```

### Phase 1: オフライン復帰時の自動同期

**変更点**:
1. `handleOnline` で未同期データをアップロード
2. `getUnsyncedNotes()` を使用して全未同期ノートを処理

**コード**:
```typescript
const handleOnline = async () => {
  setIsOnline(true);

  // 現在編集中のノートがあれば同期
  if (note.id && hasUnsyncedChanges.current) {
    try {
      await saveToCloud();
      toast.success("オンラインに復帰しました。変更を同期しました。");
    } catch {
      toast.warning("オンラインに復帰しましたが、同期に失敗しました。");
    }
  } else {
    toast.success("オンラインに復帰しました");
  }
};
```

### Phase 2: 楽観的ロック

**変更点**:
1. PUT リクエストに `expected_updated_at` を追加
2. サーバー側で不一致なら 409 を返す
3. クライアント側で 409 を受けたらコンフリクト処理

**API変更**:
```typescript
// PUT /api/notes/:id
const { expected_updated_at } = body;

if (expected_updated_at) {
  const currentNote = await supabase.from('notes').select('updated_at').eq('id', id).single();
  if (new Date(currentNote.data.updated_at).getTime() > expected_updated_at) {
    return NextResponse.json({ error: 'Conflict', status: 'conflict' }, { status: 409 });
  }
}
```

### Phase 3: 複数タブ検出

**変更点**:
1. `BroadcastChannel` でタブ間通信
2. 同じノートを編集中の他タブがあれば警告

**コード**:
```typescript
const channel = new BroadcastChannel('gitnote-sync');

// ノートロード時に通知
channel.postMessage({ type: 'NOTE_OPENED', noteId: note.id, tabId: Date.now() });

// 他タブからの通知を受信
channel.onmessage = (event) => {
  if (event.data.type === 'NOTE_OPENED' && event.data.noteId === note.id) {
    toast.warning("このノートは別のタブでも開かれています");
  }
};
```

---

## 参考資料

- [Offline-First Architecture Best Practices](https://www.droidcon.com/2025/12/16/the-complete-guide-to-offline-first-architecture-in-android/)
- [MongoDB Atlas Device Sync - Conflict Resolution](https://www.mongodb.com/docs/atlas/app-services/sync/details/conflict-resolution/)
- [Data Synchronization in PWAs](https://gtcsys.com/comprehensive-faqs-guide-data-synchronization-in-pwas-offline-first-strategies-and-conflict-resolution/)
