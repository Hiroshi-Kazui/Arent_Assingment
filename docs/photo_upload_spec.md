## 写真アップロードUI仕様（拡張版）

### 1. 目的
指摘登録時（是正前）および指摘詳細画面での追加入力時（是正前/是正後）に、モバイル・PCの双方で安定して写真アップロードできることを目的とする。

### 1.1 業務必須ルール
1. 指摘登録時は、是正前写真（`photoPhase=BEFORE`）を少なくとも1枚必須とする。
2. 完了報告を行う場合（ステータスを `DONE` に変更する場合）は、是正後写真（`photoPhase=AFTER`）を少なくとも1枚必須とする。

### 2. 対象画面と機能
1. 指摘登録モーダル（`/projects/[id]/viewer`）  
- 写真は必須（1枚以上）  
- 複数枚選択可  
- `photoPhase` は `BEFORE` 固定で送信する

2. 指摘詳細画面（`/projects/[id]/issues/[issueId]`）  
- 単一ファイル選択  
- `photoPhase` を `BEFORE` / `AFTER` から選択可能  
- 送信成功後に写真一覧を再取得して表示更新する
- 完了報告（`DONE` 変更）を行う操作フローでは、`AFTER` 写真が未登録なら完了不可とする

### 3. 入力UI仕様
HTML5標準の `input[type=file]` を使用し、ネイティブSDKは利用しない。

```html
<input
  type="file"
  accept="image/*"
  capture="environment"
/>
```

- `accept="image/*"`: 画像のみ選択可能
- `capture="environment"`: モバイルでは背面カメラを優先（OS実装に依存）
- iOS/AndroidではOS標準の選択UI（撮影/ライブラリ選択）が表示されることを期待
- PCでは `capture` は実質無視され、通常のファイル選択ダイアログを利用
- 複数枚対応が必要な画面では `multiple` を付与する

### 4. 送信仕様（API契約）
エンドポイント: `POST /api/projects/{projectId}/issues/{issueId}/photos`

リクエスト:
- `Content-Type`: `multipart/form-data`
- 必須フィールド:
  - `file`: 画像ファイル（`File`）
  - `photoPhase`: `BEFORE` または `AFTER`

成功レスポンス（201）:
```json
{
  "photoId": "uuid",
  "blobKey": "projects/{projectId}/issues/{issueId}/photos/{photoId}.{ext}"
}
```

エラーレスポンス（400）:
- `Missing required field: file`
- `Missing required field: photoPhase`
- `Invalid photoPhase: ... Must be BEFORE or AFTER`

### 5. バリデーション要件
最小要件:
1. クライアント側
- 指摘登録時、写真未選択なら登録送信しない
- 完了報告時、`AFTER` 写真が0枚なら完了操作を許可しない
- `accept="image/*"` を指定
- アップロード中は送信ボタンと入力を無効化

2. サーバー側
- `file` と `photoPhase` の必須チェック
- `photoPhase` の列挙値チェック（`BEFORE` / `AFTER`）
- 指摘登録APIでは `BEFORE` 写真が1枚以上登録されることを保証する
- ステータス更新API（`DONE` 遷移）では `AFTER` 写真が1枚以上登録済みであることを保証する

推奨追加要件（今後拡張）:
- MIME type の厳密検証（`image/jpeg`, `image/png`, `image/webp` など）
- ファイルサイズ上限（例: 10MB）
- 拡張子と実データ形式の不一致検知
- 画像以外ファイルの拒否時にユーザー向けメッセージを明示

### 6. UX要件
- 送信中は `送信中...` 表示に切り替える
- 送信成功時はフォームをリセットする
- 失敗時は API の `error` メッセージを表示する
- 写真一覧は `photoPhase` ごとにグルーピング表示する（是正前 / 是正後）

### 7. 非機能・運用要件
- ストレージキー命名規則:  
  `projects/{projectId}/issues/{issueId}/photos/{photoId}.{ext}`
- アップロード後の表示は署名付きURL取得APIで行う:
  `GET /api/photos/{photoId}/url`
- 将来の大量アップロードに備え、同時送信数制限とリトライ方針を別途定義する

### 8. 受け入れ基準（抜粋）
1. Android Chrome / iOS Safari で撮影またはライブラリ選択のいずれかでアップロードできる
2. PC Chrome で画像ファイル選択からアップロードできる
3. `photoPhase` が不正値の場合、400が返る
4. 成功後、写真一覧に即時反映される
5. 指摘登録時に写真未選択で送信しようとすると、登録できない
6. `DONE` へ変更時に `AFTER` 写真が0枚の場合、完了報告できない
