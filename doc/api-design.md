# API設計書

## 共通仕様

### Base URL
`/api`

### 認証
- すべてのエンドポイントはセッション認証（NextAuth.js）が必要
- 未認証: `401 Unauthorized`
- 権限不足: `403 Forbidden`

### レスポンス形式
- 成功: `2xx` + JSON
- 失敗: `{ "error": string }`

### エラーコード方針

| HTTP Status | 意味 |
|---|---|
| 400 | バリデーションエラー / DomainError |
| 401 | 未認証（セッションなし） |
| 403 | 権限不足（ロール不一致） |
| 404 | リソースが見つからない |
| 409 | 競合（削除不可など） |
| 415 | 非サポート Content-Type |
| 500 | サーバー内部エラー |

### ページネーション
以下のクエリパラメータが共通で利用可能：

| パラメータ | 型 | デフォルト | 最大 | 説明 |
|---|---|---|---|---|
| `page` | integer | 1 | - | ページ番号 |
| `limit` | integer | 20 | 100 | 1ページあたりの件数 |

ページネーション対応エンドポイントのレスポンス形式：
```json
{
  "items": [...],
  "totalCount": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

### Issue ステータス値
5段階のステータスが存在する：

| 値 | 日本語 | 説明 |
|---|---|---|
| `POINT_OUT` | 指摘 | 指摘登録直後（担当者未割り当て） |
| `OPEN` | 対応待ち | 担当者割り当て済み |
| `IN_PROGRESS` | 対応中 | 着手済み |
| `DONE` | 完了 | 是正完了（是正後写真必須） |
| `CONFIRMED` | 確認済み | 監督者による承認 |

状態遷移ルール：
```
POINT_OUT → OPEN      : 担当者割り当て時に自動遷移
OPEN      → IN_PROGRESS : 着手
IN_PROGRESS → DONE    : 是正完了（AFTER写真1枚以上必須）
IN_PROGRESS → OPEN    : 差し戻し
DONE      → IN_PROGRESS : 再指摘
DONE      → CONFIRMED : 確認承認
```

---

## Buildings

### GET `/api/buildings`
建物一覧を取得する。

**認可:** requireSession（全ロール可）

**クエリパラメータ:** ページネーション共通パラメータ

**レスポンス 200**
```json
{
  "items": [
    {
      "buildingId": "uuid",
      "name": "Aビル",
      "address": "Tokyo, Japan",
      "latitude": "35.6762",
      "longitude": "139.7674",
      "modelUrn": "dXJuOmFkc2sub2Jq..."
    }
  ],
  "totalCount": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

### GET `/api/buildings/{buildingId}/floors`
指定した建物のフロア一覧を取得する。

**認可:** requireSession（全ロール可）

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `buildingId` | string (UUID) | 建物ID |

**クエリパラメータ:** ページネーション共通パラメータ

**レスポンス 200**
```json
{
  "items": [
    {
      "floorId": "uuid",
      "name": "1F",
      "floorNumber": 1,
      "issueCount": 3
    }
  ],
  "totalCount": 5,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

### POST `/api/buildings/{buildingId}/initialize-model`
BIM モデルの Level 情報と部材 BoundingBox を受け取り、Floor テーブルと ElementFloorMapping テーブルを永続化する。

**認可:** requireRole(ADMIN, SUPERVISOR)

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `buildingId` | string (UUID) | 建物ID |

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `levels` | array | yes | Level 情報の配列 |
| `levels[].name` | string | yes | Level 名（例: "1F", "2F"） |
| `levels[].elevation` | number | yes | 標高値（ソートに使用） |
| `elements` | array | yes | 部材情報の配列 |
| `elements[].dbId` | number | yes | Viewer 部材 ID |
| `elements[].boundingBoxMinZ` | number | yes | BoundingBox 最小 Z 値 |

```json
{
  "levels": [
    { "name": "1F", "elevation": 0.0 },
    { "name": "2F", "elevation": 3.5 },
    { "name": "3F", "elevation": 7.0 }
  ],
  "elements": [
    { "dbId": 100, "boundingBoxMinZ": 0.5 },
    { "dbId": 101, "boundingBoxMinZ": 4.2 }
  ]
}
```

**レスポンス 201**
```json
{
  "floorsCreated": 3,
  "mappingsCreated": 2
}
```

**レスポンス 400**
```json
{ "error": "levels array is required" }
```

---

### GET `/api/buildings/{buildingId}/element-floor-mapping`
建物の全 ElementFloorMapping をフロア番号→dbId 配列の形で取得する。

**認可:** requireSession（全ロール可）

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `buildingId` | string (UUID) | 建物ID |

**クエリパラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `count` | string | no | `true` の場合、マッピング件数のみ返す |

**レスポンス 200（通常）**
```json
{
  "mappings": {
    "1": [100, 102, 105],
    "2": [101, 103, 106]
  }
}
```

**レスポンス 200（count=true）**
```json
{ "count": 500 }
```

---

### GET `/api/buildings/{buildingId}/element-floor-mapping/{dbId}`
指定した部材のフロア情報を取得する。

**認可:** requireSession（全ロール可）

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `buildingId` | string (UUID) | 建物ID |
| `dbId` | number | Viewer 部材 ID |

**レスポンス 200**
```json
{
  "floorId": "uuid",
  "floorName": "2F",
  "floorNumber": 2
}
```

**レスポンス 404**
```json
{ "error": "Element floor mapping not found" }
```

---

## Projects

### GET `/api/projects`
プロジェクト一覧を取得する。ロールによって参照スコープが異なる。
- WORKER: 自分が担当 Issue を持つプロジェクトのみ
- ADMIN / SUPERVISOR: 全プロジェクト

**認可:** requireSession（全ロール可）

**クエリパラメータ:** ページネーション共通パラメータ

**レスポンス 200**
```json
{
  "items": [
    {
      "projectId": "uuid",
      "name": "Aビル新築工事",
      "buildingId": "uuid",
      "branchId": "uuid",
      "status": "ACTIVE",
      "issueCount": 10,
      "progressRate": 0.6,
      "startDate": "2026-02-27T00:00:00.000Z",
      "dueDate": "2026-05-28T00:00:00.000Z"
    }
  ],
  "totalCount": 3,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

### GET `/api/projects/{id}`
指定したプロジェクトの詳細を取得する（関連建物情報を含む）。

**認可:** requireSession（全ロール可）

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | プロジェクトID |

**レスポンス 200**
```json
{
  "projectId": "uuid",
  "name": "Aビル新築工事",
  "buildingId": "uuid",
  "status": "ACTIVE",
  "startDate": "2026-02-27T00:00:00.000Z",
  "dueDate": "2026-05-28T00:00:00.000Z",
  "building": {
    "buildingId": "uuid",
    "name": "Aビル",
    "address": "Tokyo, Japan",
    "modelUrn": "dXJuOmFkc2sub2Jq..."
  }
}
```

**レスポンス 404**
```json
{ "error": "Project not found" }
```

---

### POST `/api/projects`
新しいプロジェクトを作成する。

**認可:** requireRole(ADMIN)

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `buildingId` | string (UUID) | yes | 対象建物ID |
| `name` | string | yes | プロジェクト名 |
| `startDate` | string (ISO 8601) | yes | 開始日 |
| `dueDate` | string (ISO 8601) | yes | 完了予定日 |
| `branchId` | string (UUID) | yes | 担当支店ID |
| `plan` | string | no | 施工計画メモ |

```json
{
  "buildingId": "uuid",
  "name": "Aビル新築工事",
  "startDate": "2026-02-27",
  "dueDate": "2026-05-28",
  "branchId": "uuid",
  "plan": "第1フェーズ: 基礎工事"
}
```

**レスポンス 201**
```json
{ "projectId": "uuid" }
```

**レスポンス 400**
```json
{ "error": "Missing required fields: buildingId, name, startDate, dueDate, branchId" }
```

---

### PATCH `/api/projects/{id}`
プロジェクト情報を更新する。

**認可:** requireRole(ADMIN)

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | プロジェクトID |

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | no | プロジェクト名 |
| `startDate` | string (ISO 8601) | no | 開始日 |
| `dueDate` | string (ISO 8601) | no | 完了予定日 |
| `plan` | string | no | 施工計画メモ |
| `status` | string | no | プロジェクトステータス |

```json
{
  "name": "Aビル改修工事",
  "dueDate": "2026-06-30",
  "status": "ACTIVE"
}
```

**レスポンス 200**
```json
{ "success": true }
```

---

## Issues

### POST `/api/projects/{id}/issues`
新しい指摘を作成する。BEFORE写真を1枚以上含める必要がある。

**認可:** requireRole(ADMIN, SUPERVISOR)

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | プロジェクトID |

**Content-Type:** `multipart/form-data` または `application/json`

multipart/form-data フィールド（JSON でも同名フィールドが必須）:

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `floorId` | string (UUID) | yes | フロアID |
| `title` | string | yes | 指摘タイトル |
| `description` | string | yes | 詳細説明 |
| `dueDate` | string (ISO 8601) | yes | 対応期限 |
| `locationType` | string | yes | `dbId` または `worldPosition` |
| `dbId` | string | no | APS モデル要素 ID（locationType=dbId 時） |
| `worldPositionX` | number | no | X 座標（locationType=worldPosition 時は必須） |
| `worldPositionY` | number | no | Y 座標（locationType=worldPosition 時は必須） |
| `worldPositionZ` | number | no | Z 座標（locationType=worldPosition 時は必須） |
| `issueType` | string | no | 指摘種別（Quality/Safety/Construction/Design） |
| `assigneeId` | string (UUID) | no | 担当者ID |
| `file` or `files` | binary | yes | BEFORE 写真（1枚以上、.jpg/.jpeg/.png/.webp） |
| `photoPhase` | string | no | `BEFORE`（省略時も BEFORE として扱われる） |

**multipart/form-data リクエスト例:**
```
POST /api/projects/{id}/issues
Content-Type: multipart/form-data

floorId=uuid
title=手すり固定不良
description=アンカー不足により手すりが不安定
dueDate=2026-03-15
locationType=dbId
dbId=12345
issueType=Quality
file=<binary>
photoPhase=BEFORE
```

**JSON リクエスト例（写真なし作成は不可）:**
```json
{
  "floorId": "uuid",
  "title": "手すり固定不良",
  "description": "アンカー不足により手すりが不安定",
  "dueDate": "2026-03-15",
  "locationType": "dbId",
  "dbId": "12345",
  "issueType": "Quality",
  "assigneeId": "uuid"
}
```

注: JSON リクエストでは写真を添付できないため、写真必須のバリデーションにより拒否される。

**レスポンス 201**
```json
{ "issueId": "uuid" }
```

**レスポンス 400 (例)**
```json
{ "error": "At least one BEFORE photo is required to create an issue" }
```
```json
{ "error": "Missing required fields: floorId, title, description, dueDate" }
```
```json
{ "error": "worldPosition requires worldPositionX/Y/Z" }
```

**レスポンス 415**
```json
{ "error": "Unsupported Content-Type. Use multipart/form-data or application/json" }
```

---

### GET `/api/projects/{id}/issues`
指定プロジェクトの指摘一覧を取得する。WORKER はアサインされた Issue のみ参照可能。

**認可:** requireSession（全ロール可、WORKER は自分の担当のみ）

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | プロジェクトID |

**クエリパラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `floorId` | string (UUID) | no | フロアID でフィルタ |
| `status` | string | no | カンマ区切りでステータスフィルタ（例: `OPEN,IN_PROGRESS`） |
| `page` | integer | no | ページ番号（デフォルト: 1） |
| `limit` | integer | no | 件数（デフォルト: 20、最大: 100） |

**レスポンス 200**
```json
{
  "items": [
    {
      "issueId": "uuid",
      "title": "手すり固定不良",
      "issueType": "Quality",
      "dueDate": "2026-03-15T00:00:00.000Z",
      "status": "OPEN",
      "priority": "MEDIUM",
      "locationType": "dbId",
      "dbId": "12345",
      "worldPositionX": null,
      "worldPositionY": null,
      "worldPositionZ": null,
      "reportedBy": "uuid-of-reporter",
      "createdAt": "2026-03-04T10:00:00.000Z",
      "updatedAt": "2026-03-04T10:00:00.000Z"
    }
  ],
  "totalCount": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

### GET `/api/projects/{id}/issues/{issueId}`
指定した Issue の詳細を取得する（写真・ステータス変更履歴・担当者情報を含む）。

**認可:** requireSession（全ロール可）

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | プロジェクトID |
| `issueId` | string (UUID) | 指摘ID |

**レスポンス 200**
```json
{
  "issueId": "uuid",
  "projectId": "uuid",
  "title": "手すり固定不良",
  "description": "アンカー不足により手すりが不安定",
  "issueType": "Quality",
  "dueDate": "2026-03-15T00:00:00.000Z",
  "status": "IN_PROGRESS",
  "priority": "MEDIUM",
  "locationType": "dbId",
  "dbId": "12345",
  "worldPositionX": null,
  "worldPositionY": null,
  "worldPositionZ": null,
  "reportedBy": "uuid-of-reporter",
  "createdAt": "2026-03-04T10:00:00.000Z",
  "updatedAt": "2026-03-04T12:00:00.000Z",
  "floorId": "uuid",
  "assigneeId": "uuid",
  "assigneeName": "山田太郎",
  "photos": [
    {
      "photoId": "uuid",
      "blobKey": "projects/{projectId}/issues/{issueId}/photos/{photoId}.jpg",
      "photoPhase": "BEFORE",
      "uploadedAt": "2026-03-04T10:00:00.000Z"
    }
  ],
  "statusChangeLogs": [
    {
      "logId": "uuid",
      "fromStatus": "POINT_OUT",
      "toStatus": "OPEN",
      "changedByName": "鈴木監督",
      "comment": "山田さんに割り当てました",
      "changedAt": "2026-03-04T11:00:00.000Z"
    }
  ]
}
```

**レスポンス 404**
```json
{ "error": "Issue not found" }
```

---

### PATCH `/api/projects/{id}/issues/{issueId}`
指摘のタイトルを更新する。

**認可:** requireRole(ADMIN, SUPERVISOR)

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | プロジェクトID |
| `issueId` | string (UUID) | 指摘ID |

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `title` | string | yes | 新しいタイトル |

```json
{ "title": "手すり固定不良（アンカーボルト増締め）" }
```

**レスポンス 200**
```json
{ "message": "Issue title updated successfully" }
```

**レスポンス 400**
```json
{ "error": "title is required" }
```

---

### DELETE `/api/projects/{id}/issues/{issueId}`
指摘を削除する。関連写真（DB + Blob）も削除される。

**認可:** requireRole(SUPERVISOR)

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | プロジェクトID |
| `issueId` | string (UUID) | 指摘ID |

**レスポンス 200**
```json
{ "message": "Issue deleted successfully" }
```

---

### PATCH `/api/projects/{id}/issues/{issueId}/status`
Issue のステータスを更新する。ドメインルールに従った状態遷移のみ許可。
`changedBy` はクライアントから受け取らずセッションから自動取得する。

**認可:** requireSession（全ロール可、ただしドメインルールによる追加制約あり）

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | プロジェクトID |
| `issueId` | string (UUID) | 指摘ID |

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `status` | string | yes | 遷移先ステータス |
| `comment` | string | no | コメント（ステータス変更履歴に記録） |

受け付けるステータス値（大文字・PascalCase どちらも可）:
`POINT_OUT` / `PointOut`, `OPEN` / `Open`, `IN_PROGRESS` / `InProgress`, `DONE` / `Done`, `CONFIRMED` / `Confirmed`

```json
{
  "status": "IN_PROGRESS",
  "comment": "本日中に是正します"
}
```

**レスポンス 200**
```json
{ "message": "Status updated successfully" }
```

**レスポンス 400**
```json
{ "error": "Missing required field: status" }
```
```json
{ "error": "Invalid status. Must be one of: PointOut, Open, InProgress, Done, Confirmed" }
```
DomainError（不正な遷移）の場合も 400 で返却。

---

### PATCH `/api/projects/{id}/issues/{issueId}/assignee`
Issue の担当者を割り当てる。POINT_OUT → OPEN への状態遷移を自動的に含む。

**認可:** requireRole(SUPERVISOR)

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | プロジェクトID |
| `issueId` | string (UUID) | 指摘ID |

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `assigneeId` | string (UUID) | yes | 担当者のユーザーID |

```json
{ "assigneeId": "uuid" }
```

**レスポンス 200**
```json
{ "message": "Assignee updated successfully" }
```

**レスポンス 400**
```json
{ "error": "Missing required field: assigneeId" }
```

---

## Photos

### POST `/api/projects/{id}/issues/{issueId}/photos`
Issue に写真をアップロードする。複数ファイルを同時アップロード可能。

**認可:** requireRole(SUPERVISOR, WORKER)

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | プロジェクトID |
| `issueId` | string (UUID) | 指摘ID |

**Content-Type:** `multipart/form-data`

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `file` or `files` | binary | yes | 写真ファイル（.jpg/.jpeg/.png/.webp、複数可） |
| `photoPhase` | string | yes | `BEFORE` / `AFTER` / `REJECTION` |

**レスポンス 201**
```json
{
  "photoId": "uuid",
  "blobKey": "projects/{projectId}/issues/{issueId}/photos/{photoId}.jpg",
  "photoIds": ["uuid"],
  "photos": [
    {
      "photoId": "uuid",
      "blobKey": "projects/{projectId}/issues/{issueId}/photos/{photoId}.jpg"
    }
  ],
  "uploadedCount": 1
}
```

複数ファイルをアップロードした場合、`photoId` と `blobKey` には最初のファイルの値が入る。全ファイルは `photos` 配列で確認できる。

**レスポンス 400 (例)**
```json
{ "error": "Missing required field: files" }
```
```json
{ "error": "Missing required field: photoPhase" }
```
```json
{ "error": "Invalid photoPhase: DRAFT. Must be BEFORE, AFTER, or REJECTION" }
```
```json
{ "error": "Invalid file extension. Allowed: .jpg, .jpeg, .png, .webp" }
```

### photoPhase 値の意味

| 値 | 用途 |
|---|---|
| `BEFORE` | 指摘登録時の施工前写真（Issue 作成時は必須） |
| `AFTER` | 是正完了後の写真（DONE への遷移に必要） |
| `REJECTION` | 是正却下時の差し戻し根拠写真 |

---

### GET `/api/photos/{photoId}/url`
写真の署名付き URL を取得する。URL は一時的なものであり有効期限がある。

**認可:** requireSession（全ロール可）

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `photoId` | string (UUID) | 写真ID |

**レスポンス 200**
```json
{ "url": "http://minio:9000/photos/projects/.../photos/uuid.jpg?X-Amz-Signature=..." }
```

**レスポンス 404**
```json
{ "error": "Photo not found" }
```

---

## Viewer

### GET `/api/viewer/token`
APS Viewer 用のアクセストークンを取得する。

**認可:** requireSession（全ロール可）

**レスポンス 200**
```json
{
  "access_token": "eyJhbGci...",
  "expires_in": 3600
}
```

**レスポンス 500**
```json
{ "error": "APS credentials not configured" }
```

---

## Auth

### GET `/api/auth/me`
現在のセッションユーザーの情報を取得する。

**認可:** セッション必須（ロール不問）

**レスポンス 200**
```json
{
  "userId": "uuid",
  "name": "山田太郎",
  "role": "WORKER",
  "organizationId": "uuid"
}
```

**レスポンス 401**
```json
{ "error": "Unauthorized" }
```

---

### GET/POST `/api/auth/[...nextauth]`
NextAuth.js のハンドラ。サインイン・サインアウト・コールバック等を処理する。

**認可:** NextAuth.js 内部処理

主なエンドポイント:
- `GET /api/auth/session` - 現在のセッション情報
- `POST /api/auth/signin/credentials` - メール/パスワードでサインイン
- `POST /api/auth/signout` - サインアウト

**サインインリクエスト (POST /api/auth/signin/credentials)**
```json
{
  "email": "yamada@example.com",
  "password": "password123"
}
```

---

## Organizations

### GET `/api/organizations`
組織一覧を取得する。

**認可:** requireRole(ADMIN)

**レスポンス 200**
```json
[
  {
    "organizationId": "uuid",
    "name": "本社",
    "type": "HEADQUARTERS",
    "parentId": null,
    "userCount": 5,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "organizationId": "uuid",
    "name": "東京支店",
    "type": "BRANCH",
    "parentId": "uuid-of-headquarters",
    "userCount": 3,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
]
```

---

### POST `/api/organizations`
新しい組織（支店）を作成する。本社（HEADQUARTERS）の子として作成される。

**認可:** requireRole(ADMIN)

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | yes | 組織名 |
| `parentId` | string (UUID) | yes | 親組織ID（本社のID） |

```json
{
  "name": "大阪支店",
  "parentId": "uuid-of-headquarters"
}
```

**レスポンス 201**
```json
{
  "organizationId": "uuid",
  "name": "大阪支店",
  "type": "BRANCH",
  "parentId": "uuid-of-headquarters",
  "createdAt": "2026-03-04T10:00:00.000Z",
  "updatedAt": "2026-03-04T10:00:00.000Z"
}
```

**レスポンス 400**
```json
{ "error": "name and parentId are required" }
```

---

### PATCH `/api/organizations/{id}`
組織名を更新する。

**認可:** requireRole(ADMIN)

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | 組織ID |

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | yes | 新しい組織名 |

```json
{ "name": "大阪支社" }
```

**レスポンス 200**
```json
{ "message": "Organization updated" }
```

---

### DELETE `/api/organizations/{id}`
組織を削除する。所属ユーザーが存在する場合は削除できない。本社（HEADQUARTERS）は削除不可。

**認可:** requireRole(ADMIN)

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | 組織ID |

**レスポンス 200**
```json
{ "message": "Organization deleted" }
```

**レスポンス 403**
```json
{ "error": "Cannot delete headquarters organization" }
```

**レスポンス 409**
```json
{ "error": "Cannot delete organization with users" }
```

---

## Users

### GET `/api/users`
ユーザー一覧を取得する。

**認可:** requireRole(ADMIN)

**レスポンス 200**
```json
[
  {
    "userId": "uuid",
    "name": "山田太郎",
    "email": "yamada@example.com",
    "role": "WORKER",
    "organizationId": "uuid",
    "isActive": true,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
]
```

---

### POST `/api/users`
新しいユーザーを作成する。

**認可:** requireRole(ADMIN)

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | yes | ユーザー名 |
| `email` | string | yes | メールアドレス |
| `password` | string | yes | パスワード |
| `role` | string | yes | `ADMIN` / `SUPERVISOR` / `WORKER` |
| `organizationId` | string (UUID) | yes | 所属組織ID |

```json
{
  "name": "佐藤花子",
  "email": "sato@example.com",
  "password": "securepassword",
  "role": "SUPERVISOR",
  "organizationId": "uuid"
}
```

**レスポンス 201**
```json
{
  "userId": "uuid",
  "name": "佐藤花子",
  "email": "sato@example.com",
  "role": "SUPERVISOR",
  "organizationId": "uuid",
  "isActive": true,
  "createdAt": "2026-03-04T10:00:00.000Z",
  "updatedAt": "2026-03-04T10:00:00.000Z"
}
```

**レスポンス 400**
```json
{ "error": "All fields are required" }
```

---

### GET `/api/users/{id}`
指定ユーザーの詳細を取得する。

**認可:** requireRole(ADMIN)

注: 現在の実装では GET `/api/users/{id}` エンドポイントは個別ルートファイルに存在しないが、
`/api/users` の一覧から個別ユーザーデータを参照することで同等の情報が取得可能。

---

### PATCH `/api/users/{id}`
ユーザー情報を更新する。

**認可:** requireRole(ADMIN)

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | ユーザーID |

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | no | ユーザー名 |
| `email` | string | no | メールアドレス |
| `role` | string | no | `ADMIN` / `SUPERVISOR` / `WORKER` |
| `organizationId` | string (UUID) | no | 所属組織ID |
| `isActive` | boolean | no | 有効/無効 |

```json
{
  "role": "SUPERVISOR",
  "isActive": true
}
```

**レスポンス 200**
```json
{ "message": "User updated" }
```

---

### DELETE `/api/users/{id}`
ユーザーを無効化（論理削除）する。物理削除ではなく `isActive: false` に更新する。

**認可:** requireRole(ADMIN)

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | ユーザーID |

**レスポンス 200**
```json
{ "message": "User deactivated" }
```

---

## Assignable Users

### GET `/api/assignable-users`
担当者として割り当て可能なユーザー一覧を取得する。WORKER・SUPERVISOR ロールの有効ユーザーのみ。未完了 Issue 件数を含む。

**認可:** requireSession（全ロール可）

**レスポンス 200**
```json
[
  {
    "userId": "uuid",
    "name": "山田太郎",
    "role": "WORKER",
    "activeIssueCount": 3
  }
]
```

---

## 認可マトリクス

以下の表はロール別のエンドポイントアクセス可否を示す。

| エンドポイント | ADMIN | SUPERVISOR | WORKER |
|---|---|---|---|
| GET /api/buildings | O | O | O |
| GET /api/buildings/{id}/floors | O | O | O |
| POST /api/buildings/{id}/initialize-model | O | O | - |
| GET /api/buildings/{id}/element-floor-mapping | O | O | O |
| GET /api/buildings/{id}/element-floor-mapping/{dbId} | O | O | O |
| GET /api/projects | O | O | O(*1) |
| GET /api/projects/{id} | O | O | O |
| POST /api/projects | O | - | - |
| PATCH /api/projects/{id} | O | - | - |
| POST /api/projects/{id}/issues | O | O | - |
| GET /api/projects/{id}/issues | O | O | O(*2) |
| GET /api/projects/{id}/issues/{issueId} | O | O | O |
| PATCH /api/projects/{id}/issues/{issueId} | O | O | - |
| DELETE /api/projects/{id}/issues/{issueId} | - | O | - |
| PATCH /api/projects/{id}/issues/{issueId}/status | O | O | O(*3) |
| PATCH /api/projects/{id}/issues/{issueId}/assignee | - | O | - |
| POST /api/projects/{id}/issues/{issueId}/photos | - | O | O |
| GET /api/photos/{photoId}/url | O | O | O |
| GET /api/viewer/token | O | O | O |
| GET /api/auth/me | O | O | O |
| GET /api/auth/[...nextauth] | O | O | O |
| POST /api/auth/[...nextauth] | O | O | O |
| GET /api/organizations | O | - | - |
| POST /api/organizations | O | - | - |
| PATCH /api/organizations/{id} | O | - | - |
| DELETE /api/organizations/{id} | O | - | - |
| GET /api/users | O | - | - |
| POST /api/users | O | - | - |
| PATCH /api/users/{id} | O | - | - |
| DELETE /api/users/{id} | O | - | - |
| GET /api/assignable-users | O | O | O |

凡例: O = アクセス可、- = アクセス不可

**補足:**
- (*1) WORKER は自分が担当 Issue を持つプロジェクトのみ一覧に表示される
- (*2) WORKER は自分がアサインされた Issue のみ参照可能
- (*3) ドメインルールによる追加制約あり（担当者のみが特定の遷移を実行可能な場合がある）
