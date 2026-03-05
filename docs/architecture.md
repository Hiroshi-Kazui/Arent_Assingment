# アーキテクチャ設計書

## 1. 概要

本プロジェクトは施工現場向け「指摘管理ツール」であり、APS (Autodesk Platform Services) Viewer と Web アプリケーションを統合したシステムです。

設計上の評価軸は「動くもの」ではなく「設計の質」であり、以下の観点を重視して設計しています。

1. 曖昧な業務要求の構造化
2. ドメイン中心設計（DDD）
3. レイヤー分離と依存方向の遵守
4. CQRS 的読み書き分離
5. 将来拡張を見据えた構造

---

## 2. 技術スタック

| レイヤー | 技術 | 選定理由 |
|---------|------|---------|
| Frontend | Next.js 15 (App Router) + TypeScript | Arent 社主力スタック。APS Viewer SDK との親和性 |
| Backend | Next.js API Routes (Route Handlers) | BFF 構成。設計上のレイヤー分離はディレクトリ構成で担保 |
| DB | PostgreSQL 16 (Docker) | リレーショナルモデルが適切。Docker で環境構築が容易 |
| Blob Storage | MinIO (Docker) | S3 互換。本番では Azure Blob Storage / S3 に移行可能 |
| ORM | Prisma | TypeScript 親和性。Repository 抽象化の実装基盤 |
| 認証 | NextAuth.js (Auth.js) v5 | Credentials Provider でメール＋パスワード認証 |
| BIM Viewer | APS Viewer SDK (Autodesk Forge) | 3D モデル表示と部材操作 |

---

## 3. 4層アーキテクチャ（Onion Architecture 簡略版）

### 3.1 レイヤー構成

```
┌─────────────────────────────────────────────────────────┐
│  Presentation（UI）                                       │
│  Next.js Pages / Components / APS Viewer SDK            │
│  src/app/                                               │
├─────────────────────────────────────────────────────────┤
│  Application（UseCase）                                   │
│  Command / Query ハンドラ, DTO                            │
│  src/application/                                       │
├─────────────────────────────────────────────────────────┤
│  Domain（ビジネスルール）★ 最重要                          │
│  集約, Value Objects, Repository Interface               │
│  src/domain/                                            │
├─────────────────────────────────────────────────────────┤
│  Infrastructure（外部依存）                               │
│  Prisma 実装, MinIO 実装, APS Token 取得                  │
│  src/infrastructure/                                    │
└─────────────────────────────────────────────────────────┘
```

### 3.2 各レイヤーの責務

| レイヤー | 責務 | 実装 |
|---------|------|------|
| Presentation | 画面表示、APS Viewer 統合、API Route Handlers | Next.js Pages / Components / Viewer SDK |
| Application | ユースケース実行、認可チェック | Command / Query ハンドラ、DTO 定義 |
| Domain | 状態遷移、バリデーション、権限ルール定義 | Issue 集約、Value Objects、Repository Interface |
| Infrastructure | DB、Blob、APS Token、認証 の具象実装 | Prisma 実装、MinIO Client、具象 Repository |

---

## 4. 依存方向（絶対に守ること）

```
Presentation --> Application --> Domain <-- Infrastructure
```

### 4.1 ルール

- **Domain 層は他のどの層にも依存しない**
  - Prisma, MinIO, Next.js 等のライブラリは一切 import 禁止
  - Node.js 組み込みモジュール（crypto 等）のみ許可
- **Infrastructure 層は Domain 層のインターフェースを実装する**（依存性逆転の原則）
  - `IssueRepository` インターフェース（Domain）→ `PrismaIssueRepository`（Infrastructure）
  - `PhotoStorage` インターフェース（Domain）→ `MinioPhotoStorage`（Infrastructure）
- **Application 層は Infrastructure の具象クラスを直接 import しない**
  - 依存性注入（DI）で受け取る

### 4.2 フレームワーク隔離の効果

| 変更シナリオ | 影響範囲 |
|------------|---------|
| PostgreSQL → Aurora に移行 | Infrastructure 層のみ変更 |
| MinIO → Azure Blob Storage に移行 | Infrastructure 層のみ変更 |
| NextAuth.js → Auth0 に移行 | Infrastructure 層のみ変更 |
| APS Viewer SDK バージョンアップ | Presentation 層のみ変更 |

---

## 5. ドメインモデル

### 5.1 エンティティ / 集約一覧

| エンティティ | 種別 | 説明 |
|------------|------|------|
| Organization | エンティティ | 本部（HEADQUARTERS）/ 支部（BRANCH）の組織 |
| User | エンティティ | Admin / Supervisor / Worker の 3 ロール |
| Building | エンティティ | 建造物（APS BIM モデル URN を保有） |
| Floor | エンティティ | フロア（BIM モデルから自動生成） |
| Project | 集約ルート | 施工プロジェクト |
| Issue | 集約ルート | 指摘（最重要の集約） |
| Photo | Issue の子エンティティ | 是正前/是正後/否認写真 |
| StatusChangeLog | Issue の子エンティティ | 状態変更履歴（否認コメント含む） |
| ElementFloorMapping | エンティティ | BIM 部材とフロアの対応付け |

### 5.2 Value Objects

| Value Object | 説明 | 実装 |
|-------------|------|------|
| Location | 指摘位置（DbId または WorldPosition） | Union Type による識別 |
| Coordinate | 建造物の地理座標（緯度・経度） | Decimal 型 |
| IssueId, UserId 等 | ブランド型 ID | TypeScript ブランド型で型安全性確保 |

#### Location Value Object の設計

```typescript
// DbId ベース（部材指摘）
interface DbIdLocation {
  readonly type: 'dbId';
  readonly dbId: string;
}

// WorldPosition ベース（空間指摘）- 今回は未実装だがモデルで両対応
interface WorldPositionLocation {
  readonly type: 'worldPosition';
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
```

現実装では DbId ベースのみ実装しているが、Union Type により将来の WorldPosition 対応を構造上保持している。

### 5.3 リレーション

```
Organization(HQ) 1 --- * Organization(Branch)
Organization     1 --- * User
Organization     1 --- * Building（branch_id）
Organization     1 --- * Project（branch_id）
Building         1 --- * Floor
Building         1 --- * Project
Building         1 --- * ElementFloorMapping
Floor            1 --- * Issue
Project          1 --- * Issue
Issue            1 --- * Photo
Issue            1 --- * StatusChangeLog
User             1 --- * Issue（reporter）
User             1 --- * Issue（assignee）
User             1 --- * StatusChangeLog（changed_by）
```

---

## 6. Issue 集約の状態遷移（8.2 ドメイン設計）

### 6.1 ステータス定義

| ステータス | 値 | 説明 |
|-----------|-----|------|
| PointOut | `POINT_OUT` | 指摘登録直後（担当者未割り当て） |
| Open | `OPEN` | 担当者割り当て済み、作業待ち |
| InProgress | `IN_PROGRESS` | 担当者が作業中 |
| Done | `DONE` | 是正完了（是正後写真必須） |
| Confirmed | `CONFIRMED` | Admin/Supervisor による承認完了 |

### 6.2 状態遷移ルール

```
POINT_OUT --> OPEN        : Assignee 設定（Admin/Supervisor が担当者を割り振る）
OPEN --> IN_PROGRESS      : 着手（Worker が作業開始）
IN_PROGRESS --> DONE      : 是正完了報告（AFTER 写真が 1 枚以上必要）
IN_PROGRESS --> OPEN      : 差し戻し（Admin/Supervisor）
DONE --> CONFIRMED        : Admin/Supervisor が確認・承認
DONE --> OPEN             : 否認（Admin/Supervisor、コメント必須）
CONFIRMED --> OPEN        : 再指摘（Admin/Supervisor、コメント必須）
```

**禁止遷移（ビジネスルール）:**
- `OPEN --> DONE`: 直接完了は禁止（InProgress を必ず経由）
- `POINT_OUT --> IN_PROGRESS`: 担当者設定なしの着手は禁止

### 6.3 PointOut スキップ

指摘作成時に Assignee を同時設定した場合、`POINT_OUT` をスキップして `OPEN` 状態で作成する。これは Issue 集約の `createWithAssignee()` ファクトリメソッドで実装されている。

### 6.4 実装場所について

状態遷移ロジックは **Issue 集約（`src/domain/models/issue.ts`）内のメソッド** として実装されている。

```typescript
// src/domain/models/issue.ts
class Issue {
  startWork(): Issue          // OPEN --> IN_PROGRESS
  complete(): Issue           // IN_PROGRESS --> DONE
  rejectWork(): Issue         // IN_PROGRESS --> OPEN（差し戻し）
  confirm(): Issue            // DONE --> CONFIRMED
  rejectCompletion(): Issue   // DONE --> OPEN（否認）
  reissue(): Issue            // CONFIRMED --> OPEN（再指摘）
  assignTo(id): Issue         // POINT_OUT --> OPEN（Assignee 設定）
}
```

Application 層はオーケストレーションのみを担当し、ビジネスルールの判断は Domain 層に委譲する。

### 6.5 権限ルール（Application 層での認可チェック）

| 操作 | 許可ロール | 追加条件 |
|------|-----------|---------|
| Issue 作成 | Admin, Supervisor | - |
| Assignee 設定 | Supervisor | - |
| OPEN → IN_PROGRESS | Worker, Admin, Supervisor | Worker は自身が Assignee の場合のみ |
| IN_PROGRESS → DONE | Worker, Admin, Supervisor | Worker は自身が Assignee の場合のみ |
| DONE → CONFIRMED | Admin, Supervisor | - |
| DONE → OPEN（否認） | Admin, Supervisor | コメント必須 |
| IN_PROGRESS → OPEN（差し戻し） | Admin, Supervisor | - |
| CONFIRMED → OPEN（再指摘） | Admin, Supervisor | コメント必須 |

**設計判断（判断11）**: 認可チェックは Application 層で行う。Domain 層に認可ロジックを置くとセッションコンテキストへのアクセス（外部依存）が必要になり、Domain 層の純粋性が損なわれるため。

---

## 7. CQRS（読み書き責務の分離）（8.3）

### 7.1 Command / Query の責務

| 種別 | 責務 | 経路 |
|------|------|------|
| Command（書き込み） | Issue 作成、ステータス変更、写真追加、Assignee 設定、Project 登録・編集、組織 CRUD、ユーザー CRUD | Domain 集約を経由。整合性を担保 |
| Query（読み取り） | プロジェクト一覧（進捗率含む）、指摘一覧（ロール別フィルタ）、指摘詳細、組織一覧、ユーザー一覧 | DB から直接読み取り。集約を経由しない |

### 7.2 Command フロー

```
API Route Handler
  ↓
Application Command Handler（認可チェック）
  ↓
Domain Aggregate（ビジネスルール検証・状態遷移）
  ↓
Repository Interface（Domain 定義）
  ↓
Prisma Repository（Infrastructure 実装）
  ↓
PostgreSQL
```

### 7.3 Query フロー

```
API Route Handler
  ↓
Application Query Handler
  ↓
Prisma Client（直接 DB アクセス）
  ↓
PostgreSQL
  ↓
DTO 変換して返却
```

Query は集約を経由しないため、N+1 問題を回避しやすく、JOIN や集計クエリを柔軟に記述できる。

### 7.4 スケーリング戦略

- **現在**: Query も同一 DB に向ける（シンプルな構成）
- **将来**: Query 側に Read Model（Materialized View / 検索用テーブル）を分離可能な構造
  - 進捗率算出は N+1 問題を招きやすいため、プロジェクト一覧 Query ではサブクエリまたは集計関数で一括算出
  - 件数増大時は Materialized View での事前計算に移行可能（判断19）

---

## 8. 永続化戦略（8.4）

### 8.1 Repository 抽象化

Domain 層でインターフェースのみを定義し、Infrastructure 層が具象実装を提供する。

```typescript
// src/domain/repositories/issue-repository.ts（Domain 層）
interface IssueRepository {
  findById(id: IssueId): Promise<Issue | undefined>;
  save(issue: Issue): Promise<void>;
  // ...
}

// src/infrastructure/prisma/（Infrastructure 層）
class PrismaIssueRepository implements IssueRepository { ... }
```

### 8.2 DB 隔離

- DB スキーマの変更（カラム追加等）は Infrastructure 層にのみ影響
- Domain モデルは DB スキーマに依存しない純粋な TypeScript クラス
- `reconstruct()` ファクトリメソッドで DB から Domain モデルへの変換を担当

### 8.3 Blob 保存戦略

```
キー命名規則:
projects/{projectId}/issues/{issueId}/photos/{photoId}.{ext}

DB には BlobKey のみ保存:
- URL は PhotoStorage.getUrl() で動的生成（署名付き URL）
- ストレージ移行時も URL が変わらない設計
```

**アップロード順序**: Blob 保存 → DB 記録（BlobKey）

この順序の理由: 逆順（DB 先）だと DB にキーがあるのにファイルが存在しない状態が危険。Blob 先を採用することで孤立レコードを防ぐ。（判断2）

### 8.4 DB と Blob の整合性

- 失敗時: Blob に孤立ファイルが残る可能性あり
- 対策: 定期クリーンアップジョブで孤立ファイルを削除（本番設計）

### 8.5 Location 情報のカラム設計

```sql
-- Issue テーブル内に正規化カラムで保持（JSON 列は不採用）
location_type      VARCHAR  -- 'dbId' | 'worldPosition'
db_id              INTEGER  -- 部材指摘時
world_position_x   DECIMAL  -- 空間指摘時
world_position_y   DECIMAL
world_position_z   DECIMAL
```

JSON 列ではなく正規化カラムを採用した理由（判断3）: クエリ性能への影響を排除し、インデックスを利用可能にするため。

### 8.6 トランザクション境界

#### 現在の実装

- **単一 DB 操作**: Prisma の暗黙トランザクション（単一 `create` / `update`）に依拠。Issue 作成 + Photo 登録など複数テーブル操作は `prisma.$transaction()` でアトミック性を担保
- **Blob + DB の跨ぎ操作**: §8.4 の Blob-first 戦略により、Blob 保存成功後に DB 記録。DB 書込み失敗時は孤立 Blob が残るが、データ不整合（DB にキーがあるのにファイルが存在しない）は発生しない

#### 16 時間制約による未実装事項

- **Outbox パターン**: Blob 保存イベントを Outbox テーブルに記録し、バックグラウンドワーカーが非同期で DB 更新。失敗時の自動リトライが可能になる
- **Saga パターン**: 複数集約をまたぐ操作（将来の Issue 一括ステータス更新等）に適用。補償トランザクションによるロールバック戦略を想定
- **べき等キー**: 写真アップロード API にべき等キー（Idempotency-Key ヘッダー）を導入し、リトライ時の重複登録を防止

---

## 9. 外部依存の隔離（8.5）

### 9.1 APS（Autodesk Platform Services）依存

```typescript
// Domain 層でインターフェース定義（src/domain/repositories/viewer-token-provider.ts）
interface ViewerTokenProvider {
  getAccessToken(): Promise<{ token: string; expiresIn: number }>;
}

// Infrastructure 層で具象実装（src/infrastructure/aps/）
class ApsViewerTokenProvider implements ViewerTokenProvider {
  // 2-legged OAuth で具象実装
}
```

Viewer SDK 自体はフロントエンドで直接利用（UI の関心事）。

### 9.2 ストレージ（MinIO）依存

```typescript
// Domain 層でインターフェース定義（src/domain/repositories/photo-storage.ts）
interface PhotoStorage {
  upload(key: string, file: Buffer, contentType: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}

// Infrastructure 層で具象実装（src/infrastructure/minio/）
class MinioPhotoStorage implements PhotoStorage {
  // MinIO S3 互換 API で具象実装
}
```

### 9.3 認証（NextAuth.js）依存

- NextAuth.js は Infrastructure 層に閉じ込める
- Application 層は `CurrentUser` 型（role, userId, organizationId）のみを受け取る
- 将来の OAuth 移行（Azure AD B2C 等）も `providers` 配列の変更のみで対応可能

---

## 10. 本番設計（8.6）

### 10.1 クラウドアーキテクチャ

| コンポーネント | Azure 構成 | AWS 構成 |
|-------------|-----------|---------|
| アプリケーション | App Service | ECS Fargate |
| データベース | Azure Database for PostgreSQL | Aurora PostgreSQL |
| Blob Storage | Azure Blob Storage | S3 |
| CDN | Azure CDN | CloudFront |
| 認証 | Azure AD B2C | Cognito |

### 10.2 認証・認可の本番設計

- **認証**: Azure AD B2C または Auth0。メール招待ベースの現場ユーザー登録。SSO 対応
- **認可**: 3 ロール制（Admin / Supervisor / Worker）を維持
- **セッション**: JWT 戦略（NextAuth.js）から OAuth トークンへの移行は `providers` 配列の変更のみ

### 10.3 マルチテナント対応

- Organization テーブルの `parent_id` による本部・支部の 1 階層構造
- RLS（Row Level Security）またはアプリ層でのテナント分離
- 将来の多階層対応: Closure Table パターンへの移行（判断12）

### 10.4 大量データ対応

- Query 側に Read Model（Materialized View）を分離
- ページネーション（page / limit クエリパラメータ）を全一覧 API に実装済み
- 進捗率は Materialized View での事前計算に移行可能（判断19）
- Blob: CDN 経由配信。サムネイル自動生成（Azure Functions / Lambda）

### 10.5 BIM フロア判定の設計

BIM モデルの `levelプロパティ`は信頼できないことが実データで確認された（判断16）。そのため以下の戦略を採用:

1. **Stage 1（サーバーサイド）**: APS Model Derivative API からレベル名を抽出し Floor レコードを生成
2. **Stage 2（クライアントサイド）**: Viewer 起動時に全部材の BoundingBox Z 座標からフロア標高を推定
3. **ElementFloorMapping**: BoundingBox 底面 Z 座標でフロア判定し永続化（キャッシュ）

### 10.6 同時実行制御

#### 課題

2 人の Supervisor が同一 Issue のステータスを同時に変更した場合、後勝ち（Last Write Wins）になり、先の変更が暗黙に上書きされる。

#### 本番設計: 楽観ロック

- Issue テーブルに `version INT NOT NULL DEFAULT 0` カラムを追加
- UPDATE 時に `WHERE issue_id = :id AND version = :expected` 条件を付与
- version 不一致時は `OptimisticLockError` を送出し、クライアントにリトライまたは再読込を促す
- Prisma では `@updatedAt` + カスタム where 条件、または Prisma Client Extensions で実装可能

#### 16 時間制約による判断

現状はシングルユーザー利用を前提とし、楽観ロックは未実装。マルチユーザー環境では version カラム導入を最優先で対応する。

---

## 11. ディレクトリ構成

```
src/
├── domain/                    # ★ 他の層に依存しない
│   ├── models/
│   │   ├── issue.ts           # Issue 集約ルート（状態遷移メソッド実装）
│   │   ├── organization.ts    # Organization エンティティ
│   │   ├── user.ts            # User エンティティ（Role enum）
│   │   ├── building.ts        # Building エンティティ
│   │   ├── floor.ts           # Floor エンティティ
│   │   ├── project.ts         # Project 集約
│   │   ├── photo.ts           # Photo エンティティ
│   │   ├── status-change-log.ts  # StatusChangeLog エンティティ
│   │   ├── location.ts        # Location Value Object
│   │   ├── coordinate.ts      # Coordinate Value Object
│   │   └── element-floor-mapping.ts
│   ├── repositories/          # インターフェースのみ（実装なし）
│   │   ├── issue-repository.ts
│   │   ├── photo-storage.ts   # PhotoStorage インターフェース
│   │   ├── viewer-token-provider.ts
│   │   └── ...
│   └── errors/                # ドメインエラー
│       ├── domain-error.ts
│       └── invalid-status-transition-error.ts
├── application/
│   ├── commands/              # 書き込み系ユースケース
│   └── queries/               # 読み取り系ユースケース
│       └── dto/
├── infrastructure/
│   ├── prisma/                # Prisma 具象 Repository
│   ├── minio/                 # MinIO PhotoStorage 実装
│   ├── aps/                   # APS TokenProvider 実装
│   └── auth/                  # NextAuth Provider 実装
└── app/                       # Next.js Presentation 層
    ├── api/                   # Route Handlers
    └── components/
```
