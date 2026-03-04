# API 設計書

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

### エラーコード

| HTTP Status | 意味 |
|---|---|
| 400 | バリデーションエラー / DomainError（不正な状態遷移等） |
| 401 | 未認証（セッションなし） |
| 403 | 権限不足（ロール不一致） |
| 404 | リソースが見つからない |
| 409 | 競合（削除不可など） |
| 415 | 非サポート Content-Type |
| 500 | サーバー内部エラー |

### ページネーション
以下のクエリパラメータが共通で利用可能:

| パラメータ | 型 | デフォルト | 最大 | 説明 |
|---|---|---|---|---|
| `page` | integer | 1 | - | ページ番号 |
| `limit` | integer | 20 | 100 | 1 ページあたりの件数 |

ページネーション対応エンドポイントのレスポンス形式:
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

| 値 | 日本語 | 説明 |
|---|---|---|
| `POINT_OUT` | 指摘 | 指摘登録直後（担当者未割り当て） |
| `OPEN` | 対応待ち | 担当者割り当て済み |
| `IN_PROGRESS` | 対応中 | 着手済み |
| `DONE` | 完了 | 是正完了（AFTER 写真必須） |
| `CONFIRMED` | 確認済み | Admin/Supervisor による承認 |

状態遷移ルール:
```
POINT_OUT  --> OPEN        : 担当者割り当て時
OPEN       --> IN_PROGRESS : 着手
IN_PROGRESS --> DONE       : 是正完了（AFTER 写真 1 枚以上必須）
IN_PROGRESS --> OPEN       : 差し戻し
DONE       --> CONFIRMED   : 確認承認
DONE       --> OPEN        : 否認（コメント必須）
CONFIRMED  --> OPEN        : 再指摘（コメント必須）
```

---

## エンドポイント一覧

| Method | Path | 種別 | 権限 | 説明 |
|--------|------|------|------|------|
| GET | /api/buildings | Query | 全ロール | 建物一覧取得 |
| GET | /api/buildings/{buildingId}/floors | Query | 全ロール | フロア一覧取得 |
| POST | /api/buildings/{buildingId}/initialize-model | Command | ADMIN, SUPERVISOR | BIM モデル初期化（Floor + ElementFloorMapping 生成） |
| GET | /api/buildings/{buildingId}/element-floor-mapping | Query | 全ロール | 部材フロアマッピング取得 |
| GET | /api/buildings/{buildingId}/element-floor-mapping/{dbId} | Query | 全ロール | 単一部材のフロア情報取得 |
| GET | /api/buildings/{buildingId}/sync-levels | Query/Command | 認証済み | APS からレベル情報を同期 |
| GET | /api/projects | Query | 全ロール（WORKER はスコープ制限あり） | プロジェクト一覧（進捗率含む） |
| GET | /api/projects/{id} | Query | 全ロール | プロジェクト詳細（建物情報含む） |
| POST | /api/projects | Command | ADMIN | プロジェクト作成 |
| PATCH | /api/projects/{id} | Command | ADMIN | プロジェクト更新 |
| POST | /api/projects/{id}/issues | Command | ADMIN, SUPERVISOR | 指摘作成（BEFORE 写真必須） |
| GET | /api/projects/{id}/issues | Query | 全ロール（WORKER はスコープ制限あり） | 指摘一覧（フロア・ステータスフィルタ） |
| GET | /api/projects/{id}/issues/{issueId} | Query | 全ロール | 指摘詳細（写真・履歴含む） |
| PATCH | /api/projects/{id}/issues/{issueId} | Command | ADMIN, SUPERVISOR | 指摘タイトル更新 |
| DELETE | /api/projects/{id}/issues/{issueId} | Command | SUPERVISOR | 指摘削除（写真含む） |
| PATCH | /api/projects/{id}/issues/{issueId}/status | Command | 全ロール（制約あり） | ステータス変更 |
| PATCH | /api/projects/{id}/issues/{issueId}/assignee | Command | SUPERVISOR | 担当者割り当て |
| POST | /api/projects/{id}/issues/{issueId}/photos | Command | SUPERVISOR, WORKER | 写真アップロード |
| GET | /api/photos/{photoId}/url | Query | 全ロール | 写真署名付き URL 取得 |
| GET | /api/viewer/token | Query | 全ロール | APS アクセストークン取得 |
| GET | /api/auth/me | Query | 認証済み | 現在ユーザー情報取得 |
| GET/POST | /api/auth/[...nextauth] | - | - | NextAuth.js ハンドラ |
| GET | /api/organizations | Query | ADMIN | 組織一覧取得 |
| POST | /api/organizations | Command | ADMIN | 組織（支店）作成 |
| PATCH | /api/organizations/{id} | Command | ADMIN | 組織名更新 |
| DELETE | /api/organizations/{id} | Command | ADMIN | 組織削除 |
| GET | /api/users | Query | ADMIN | ユーザー一覧取得 |
| POST | /api/users | Command | ADMIN | ユーザー作成 |
| PATCH | /api/users/{id} | Command | ADMIN | ユーザー更新 |
| DELETE | /api/users/{id} | Command | ADMIN | ユーザー無効化（論理削除） |
| GET | /api/assignable-users | Query | 全ロール | 担当割り当て可能ユーザー一覧 |

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

指定した建物のフロア一覧を取得する。フロア番号昇順でソート。

**認可:** requireSession（全ロール可）

**パスパラメータ:**

| パラメータ | 型 | 説明 |
|---|---|---|
| `buildingId` | string (UUID) | 建物 ID |

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

BIM モデルの Level 情報と部材 BoundingBox を受け取り、Floor テーブルと ElementFloorMapping テーブルを永続化する。Viewer 起動時にフロントエンドから呼び出される。

**認可:** requireRole(ADMIN, SUPERVISOR)

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `levels` | array | yes | Level 情報の配列 |
| `levels[].name` | string | yes | Level 名（例: "1F", "2F"） |
| `levels[].elevation` | number | yes | 標高値 |
| `elements` | array | yes | 部材情報の配列 |
| `elements[].dbId` | number | yes | Viewer 部材 ID |
| `elements[].boundingBoxMinZ` | number | yes | BoundingBox 最小 Z 値 |

**レスポンス 201**
```json
{
  "floorsCreated": 3,
  "mappingsCreated": 2
}
```

---

### GET `/api/buildings/{buildingId}/element-floor-mapping`

建物の全 ElementFloorMapping をフロア番号→dbId 配列の形で取得する。

**認可:** requireSession（全ロール可）

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

**レスポンス 200**
```json
{
  "floorId": "uuid",
  "floorName": "2F",
  "floorNumber": 2
}
```

---

## Projects

### GET `/api/projects`

プロジェクト一覧を取得する。ロールによって参照スコープが異なる。
- WORKER: 自分が担当 Issue を持つプロジェクトのみ（進捗率・件数も担当分のみで算出）
- ADMIN / SUPERVISOR: 全プロジェクト

**認可:** requireSession（全ロール可）

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

**進捗率の算出ルール:**
- DONE = 50%, CONFIRMED = 100%, それ以外 = 0%
- 全指摘スコアの平均（指摘 0 件の場合は 0%）

---

### GET `/api/projects/{id}`

指定したプロジェクトの詳細を取得する（関連建物情報を含む）。

**認可:** requireSession（全ロール可）

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

---

### POST `/api/projects`

新しいプロジェクトを作成する。

**認可:** requireRole(ADMIN)

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `buildingId` | string (UUID) | yes | 対象建物 ID |
| `name` | string | yes | プロジェクト名 |
| `startDate` | string (ISO 8601) | yes | 開始日 |
| `dueDate` | string (ISO 8601) | yes | 完了予定日 |
| `branchId` | string (UUID) | yes | 担当支店 ID |
| `plan` | string | no | 施工計画メモ |

**レスポンス 201**
```json
{ "projectId": "uuid" }
```

---

### PATCH `/api/projects/{id}`

プロジェクト情報を更新する。

**認可:** requireRole(ADMIN)

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | no | プロジェクト名 |
| `startDate` | string (ISO 8601) | no | 開始日 |
| `dueDate` | string (ISO 8601) | no | 完了予定日 |
| `plan` | string | no | 施工計画メモ |
| `status` | string | no | プロジェクトステータス |

**レスポンス 200**
```json
{ "success": true }
```

---

## Issues

### POST `/api/projects/{id}/issues`

新しい指摘を作成する。BEFORE 写真を 1 枚以上含める必要がある。Assignee を同時指定した場合は POINT_OUT をスキップして OPEN で作成される。

**認可:** requireRole(ADMIN, SUPERVISOR)

**Content-Type:** `multipart/form-data`

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `floorId` | string (UUID) | yes | フロア ID |
| `title` | string | yes | 指摘タイトル |
| `description` | string | yes | 詳細説明 |
| `dueDate` | string (ISO 8601) | yes | 対応期限 |
| `locationType` | string | yes | `dbId` または `worldPosition` |
| `dbId` | string | no | APS モデル要素 ID（locationType=dbId 時） |
| `worldPositionX` | number | no | X 座標（locationType=worldPosition 時は必須） |
| `worldPositionY` | number | no | Y 座標 |
| `worldPositionZ` | number | no | Z 座標 |
| `issueType` | string | no | QUALITY / SAFETY / CONSTRUCTION / DESIGN |
| `assigneeId` | string (UUID) | no | 担当者 ID（指定時は OPEN で作成） |
| `file` / `files` | binary | yes | BEFORE 写真（jpg/jpeg/png/webp、1 枚以上） |

**レスポンス 201**
```json
{ "issueId": "uuid" }
```

**レスポンス 400 (例)**
```json
{ "error": "At least one BEFORE photo is required to create an issue" }
```

---

### GET `/api/projects/{id}/issues`

指定プロジェクトの指摘一覧を取得する。WORKER はアサインされた Issue のみ参照可能。

**認可:** requireSession（全ロール可、WORKER は自分の担当のみ）

**クエリパラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `floorId` | string (UUID) | no | フロア ID でフィルタ |
| `status` | string | no | カンマ区切りでステータスフィルタ（例: `OPEN,IN_PROGRESS`） |
| `page` | integer | no | ページ番号 |
| `limit` | integer | no | 件数 |

**レスポンス 200**
```json
{
  "items": [
    {
      "issueId": "uuid",
      "title": "手すり固定不良",
      "issueType": "QUALITY",
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

**レスポンス 200**
```json
{
  "issueId": "uuid",
  "projectId": "uuid",
  "title": "手すり固定不良",
  "description": "アンカー不足により手すりが不安定",
  "issueType": "QUALITY",
  "dueDate": "2026-03-15T00:00:00.000Z",
  "status": "IN_PROGRESS",
  "priority": "MEDIUM",
  "locationType": "dbId",
  "dbId": "12345",
  "worldPositionX": null,
  "worldPositionY": null,
  "worldPositionZ": null,
  "reportedBy": "uuid-of-reporter",
  "assigneeId": "uuid",
  "assigneeName": "山田太郎",
  "createdAt": "2026-03-04T10:00:00.000Z",
  "updatedAt": "2026-03-04T12:00:00.000Z",
  "floorId": "uuid",
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

---

### PATCH `/api/projects/{id}/issues/{issueId}`

指摘のタイトルを更新する。

**認可:** requireRole(ADMIN, SUPERVISOR)

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `title` | string | yes | 新しいタイトル |

**レスポンス 200**
```json
{ "message": "Issue title updated successfully" }
```

---

### DELETE `/api/projects/{id}/issues/{issueId}`

指摘を削除する。関連写真（DB + Blob）も削除される。

**認可:** requireRole(SUPERVISOR)

**レスポンス 200**
```json
{ "message": "Issue deleted successfully" }
```

---

### PATCH `/api/projects/{id}/issues/{issueId}/status`

Issue のステータスを更新する。ドメインルールに従った状態遷移のみ許可。`changedBy` はセッションから自動取得する。

**認可:** requireSession（全ロール可、ただしドメインルールによる追加制約あり）

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `status` | string | yes | 遷移先ステータス |
| `comment` | string | no | コメント（否認・再指摘時は必須） |

受け付けるステータス値（大文字・PascalCase どちらも可）:
`POINT_OUT` / `PointOut`, `OPEN` / `Open`, `IN_PROGRESS` / `InProgress`, `DONE` / `Done`, `CONFIRMED` / `Confirmed`

**レスポンス 200**
```json
{ "message": "Status updated successfully" }
```

**レスポンス 400（ドメインエラー例）**
```json
{ "error": "Invalid status transition from IN_PROGRESS to CONFIRMED" }
```

---

### PATCH `/api/projects/{id}/issues/{issueId}/assignee`

Issue の担当者を割り当てる。POINT_OUT → OPEN への状態遷移を自動的に含む。

**認可:** requireRole(SUPERVISOR)

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `assigneeId` | string (UUID) | yes | 担当者のユーザー ID |

**レスポンス 200**
```json
{ "message": "Assignee updated successfully" }
```

---

## Photos

### POST `/api/projects/{id}/issues/{issueId}/photos`

Issue に写真をアップロードする。複数ファイルを同時アップロード可能。

**認可:** requireRole(SUPERVISOR, WORKER)

**Content-Type:** `multipart/form-data`

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `file` / `files` | binary | yes | 写真ファイル（jpg/jpeg/png/webp、複数可） |
| `photoPhase` | string | yes | `BEFORE` / `AFTER` / `REJECTION` |

**photoPhase の意味:**

| 値 | 用途 |
|---|---|
| `BEFORE` | 指摘登録時の施工前写真（Issue 作成時は必須） |
| `AFTER` | 是正完了後の写真（DONE への遷移に必要） |
| `REJECTION` | 是正否認時の差し戻し根拠写真 |

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

---

### GET `/api/photos/{photoId}/url`

写真の署名付き URL を取得する。URL は一時的なものであり有効期限がある。

**認可:** requireSession（全ロール可）

**レスポンス 200**
```json
{ "url": "http://minio:9000/photos/projects/.../photos/uuid.jpg?X-Amz-Signature=..." }
```

---

## Viewer

### GET `/api/viewer/token`

APS Viewer 用のアクセストークンを取得する。2-legged OAuth で取得。

**認可:** requireSession（全ロール可）

**レスポンス 200**
```json
{
  "access_token": "eyJhbGci...",
  "expires_in": 3600
}
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

---

### GET/POST `/api/auth/[...nextauth]`

NextAuth.js のハンドラ。サインイン・サインアウト・コールバック等を処理する。

主なエンドポイント:
- `GET /api/auth/session` - 現在のセッション情報
- `POST /api/auth/signin/credentials` - メール/パスワードでサインイン
- `POST /api/auth/signout` - サインアウト

**サインインリクエスト:**
```json
{
  "email": "yamada@example.com",
  "password": "password123"
}
```

---

## Organizations

### GET `/api/organizations`

組織一覧を取得する（本部・全支店含む）。

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

新しい組織（支店）を作成する。

**認可:** requireRole(ADMIN)

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | yes | 組織名 |
| `parentId` | string (UUID) | yes | 親組織 ID（本社の ID） |

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

---

### PATCH `/api/organizations/{id}`

組織名を更新する。

**認可:** requireRole(ADMIN)

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | yes | 新しい組織名 |

**レスポンス 200**
```json
{ "message": "Organization updated" }
```

---

### DELETE `/api/organizations/{id}`

組織を削除する。所属ユーザーが存在する場合は削除できない。本社（HEADQUARTERS）は削除不可。

**認可:** requireRole(ADMIN)

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

新しいユーザーを作成する。パスワードは bcrypt でハッシュ化して保存。

**認可:** requireRole(ADMIN)

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | yes | ユーザー名 |
| `email` | string | yes | メールアドレス（一意） |
| `password` | string | yes | パスワード |
| `role` | string | yes | `ADMIN` / `SUPERVISOR` / `WORKER` |
| `organizationId` | string (UUID) | yes | 所属組織 ID |

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

---

### PATCH `/api/users/{id}`

ユーザー情報を更新する。

**認可:** requireRole(ADMIN)

**リクエストボディ (application/json)**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | no | ユーザー名 |
| `email` | string | no | メールアドレス |
| `role` | string | no | `ADMIN` / `SUPERVISOR` / `WORKER` |
| `organizationId` | string (UUID) | no | 所属組織 ID |
| `isActive` | boolean | no | 有効/無効 |

**レスポンス 200**
```json
{ "message": "User updated" }
```

---

### DELETE `/api/users/{id}`

ユーザーを無効化（論理削除）する。物理削除ではなく `isActive: false` に更新する。

**認可:** requireRole(ADMIN)

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
| GET/POST /api/auth/[...nextauth] | O | O | O |
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
- (*1) WORKER は自分が担当 Issue を持つプロジェクトのみ表示。進捗率・件数も担当分のみで算出
- (*2) WORKER は自分がアサインされた Issue のみ参照可能
- (*3) ドメインルールによる追加制約あり（担当者のみが特定の遷移を実行可能）
