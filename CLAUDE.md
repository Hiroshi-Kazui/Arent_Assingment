# CLAUDE.md - プロジェクト設計指示書

## プロジェクト概要
施工現場向け「指摘管理ツール」。APS Viewer × Webアプリ。
Arent社PM業務体験課題（16時間制約）。
**「動くもの」より「設計の質」が評価対象。**

## 技術スタック
- Frontend/Backend: Next.js (App Router) + TypeScript
- DB: PostgreSQL（Docker）
- Blob Storage: MinIO（Docker）
- ORM: Prisma
- 認証: なし（将来設計としてREADMEに記載）

## アーキテクチャ原則

### 4層構造（Onion Architecture簡略版）
```
Presentation（UI）     → Next.js Pages / Components / APS Viewer SDK
Application（UseCase） → Command / Query ハンドラ, DTO
Domain（ビジネスルール） → 集約, Value Objects, Repository Interface
Infrastructure（外部依存）→ Prisma実装, MinIO実装, APS Token取得
```

### 依存方向（絶対に守ること）
```
Presentation → Application → Domain ← Infrastructure
```
- Domain層は他のどの層にも依存しない
- Infrastructure層はDomain層のインターフェースを実装する（依存性逆転）
- Domain層でPrisma, MinIO, Next.js等のimportは禁止

### CQRS
- Command（書き込み）: Domain集約を経由。整合性を担保
- Query（読み取り）: DBから直接読み取り。集約を経由しない

## ディレクトリ構成
```
/
├── docker-compose.yml
├── README.md
├── docs/
│   ├── architecture.md
│   ├── architecture.mmd
│   ├── er-diagram.mmd
│   └── api-design.md
├── src/
│   ├── domain/                # ★ 他の層に依存しない
│   │   ├── models/
│   │   │   ├── building.ts
│   │   │   ├── floor.ts
│   │   │   ├── project.ts
│   │   │   ├── issue.ts      # Issue集約ルート
│   │   │   ├── photo.ts
│   │   │   ├── location.ts   # Location Value Object
│   │   │   └── coordinate.ts # Coordinate Value Object
│   │   ├── repositories/     # Repository インターフェース
│   │   └── errors/           # ドメインエラー
│   ├── application/
│   │   ├── commands/          # CreateIssue, UpdateIssueStatus, AddPhoto
│   │   ├── queries/           # ListIssues, GetIssueDetail, ListProjects, ListFloors
│   │   └── dto/
│   ├── infrastructure/
│   │   ├── prisma/            # 具象Repository
│   │   ├── minio/             # PhotoStorage実装
│   │   └── aps/               # APS TokenProvider実装
│   └── app/                   # Next.js Presentation層
│       ├── api/               # Route Handlers
│       ├── components/
│       └── (pages)/
├── prisma/
│   └── schema.prisma
└── .env.example
```

## ドメインモデル

### エンティティ / 集約

**Building（建造物）**
- BuildingId, Name, Address, Coordinate(lat/lng), ModelUrn(APS BIM URN)
- Floors[], CreatedAt, UpdatedAt

**Floor（フロア）**
- FloorId, BuildingId(FK), Name("1F","B1F"), FloorNumber(sort用), CreatedAt, UpdatedAt

**Project（集約ルート）**
- ProjectId, Name, BuildingId(FK), StartDate, DueDate, Status(Planning/Active/Completed)
- CreatedAt, UpdatedAt

**Issue（集約ルート）** ← 最重要
- IssueId, ProjectId(FK), FloorId(FK)
- Title, Description, IssueType(Quality/Safety/Construction/Design)
- Status(Open/InProgress/Done)
- Location: Value Object（LocationType + DbId? + WorldPosition?)
- Photos[]: PhotoId, BlobKey, PhotoPhase(Before/After), UploadedAt
- ReportedBy, CreatedAt, UpdatedAt

**Photo（Issueの子エンティティ）**
- PhotoId, IssueId(FK), BlobKey, PhotoPhase(Before/After), UploadedAt

### リレーション
```
Building 1 ─── * Floor
Building 1 ─── * Project
Project  1 ─── * Issue
Floor    1 ─── * Issue
Issue    1 ─── * Photo
```

### 状態遷移ルール（Issue集約内に実装すること）
```
Open → InProgress : 着手
InProgress → Done : 是正完了（是正後写真1枚以上必要）
InProgress → Open : 差し戻し
Done → InProgress : 再指摘
```
**Open → Done の直接遷移は禁止（ビジネスルール）**

## DB設計方針
- Issue集約 → issuesテーブル + photosテーブル
- Location情報: locationType + dbId + worldPositionX/Y/Zカラム（JSON列は不採用）
- Building/Floor/Projectはシードデータで投入（CRUDは実装しない）

## Blob保存戦略
- キー命名: `projects/{projectId}/issues/{issueId}/photos/{photoId}.{ext}`
- DB側にはBlobKeyのみ保持（URLは動的生成・署名付き）
- アップロード順序: ① Blob保存 → ② DB記録

## 外部依存の隔離パターン
```typescript
// Domain層にインターフェースを定義
interface PhotoStorage {
  upload(key: string, file: Buffer, contentType: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}

interface ViewerTokenProvider {
  getAccessToken(): Promise<{ token: string; expiresIn: number }>;
}

// Infrastructure層で具象実装
class MinioPhotoStorage implements PhotoStorage { ... }
class ApsViewerTokenProvider implements ViewerTokenProvider { ... }
```

## API設計
| Method | Path | 種別 |
|--------|------|------|
| GET | /api/buildings | Query |
| GET | /api/buildings/{buildingId}/floors | Query |
| GET | /api/projects | Query |
| GET | /api/projects/{id} | Query |
| GET | /api/viewer/token | Query |
| POST | /api/projects/{id}/issues | Command |
| GET | /api/projects/{id}/issues | Query (?floorId=) |
| GET | /api/projects/{id}/issues/{issueId} | Query |
| PATCH | /api/projects/{id}/issues/{issueId}/status | Command |
| POST | /api/projects/{id}/issues/{issueId}/photos | Command |
| GET | /api/photos/{photoId}/url | Query |

## コーディング規約
- TypeScript strict mode
- 命名: camelCase（変数/関数）、PascalCase（型/クラス/インターフェース）
- エラー: Domain層はカスタムエラークラス、Application層でキャッチしてDTO変換
- ID: UUID v4
- 日時: ISO 8601形式

## 設計上の注意事項
- 空間指摘（worldPosition）は今回実装しない。ただしドメインモデルでは両対応の構造を維持
- Assignee（作業担当者）は最低要件に含めない
- Building/Floor/Projectの作成APIは不要（シードデータで代替）
- 本番想定の設計判断はREADMEに言語化すること
