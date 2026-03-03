# Phase 0: 構築計画（設計準備）

## 0.1 課題の本質理解

### 評価軸の整理
この課題は「動くもの」ではなく「設計の質」を見ている。評価される能力：

1. **曖昧な業務要求 → 構造化**（ヒアリングメモから要件を抽出する力）
2. **ドメイン中心設計**（Issue集約の設計品質）
3. **レイヤー分離と依存方向**（Clean Architecture的思考）
4. **CQRS的思考**（読み書き責務の分離）
5. **将来拡張を見据えた構造**（本番想定の設計判断）
6. **設計を言語化する力**（READMEの記述品質）

---

## 0.2 ヒアリングメモからの要件構造化

### 現場の課題（As-Is）
| 発言者 | 課題 | 本質 |
|--------|------|------|
| 佐藤（監督） | 写真だけでは場所が伝わらない | 指摘と3D位置の紐づけ不在 |
| 山本（設備） | Excel/チャットに情報が散在 | 指摘情報の一元管理不在 |
| 中村（安全） | 現場で再現できる位置情報がない | 空間座標の記録不在 |
| 佐藤（監督） | 是正後写真も残したい、履歴を追いたい | 指摘のライフサイクル管理不在 |

### 導出される要件（To-Be）
| # | 要件 | 種別 |
|---|------|------|
| R1 | 指摘に3D上の位置（dbId or worldPosition）が必ず紐づく | 必須 |
| R2 | 指摘に写真を複数添付できる（是正前/是正後の区分） | 必須 |
| R3 | 指摘の状態管理（PointOut / Open / InProgress / Done / Confirmed） | 必須 |
| R4 | 一覧から3D上の該当箇所へ即座に遷移できる | 必須 |
| R5 | APS Viewerで3Dモデルを表示 | 必須 |
| R6 | 3Dモデル上にピンを登録できる | 必須 |
| R7 | 組織（本部・支部）によるプロジェクト・建造物の管理 | 拡張 |
| R8 | ロールベースのアクセス制御（Admin/Supervisor/Worker） | 拡張 |
| R9 | 指摘の作業担当者割り振り（Assignee） | 拡張 |
| R10 | 是正完了後のSupervisor確認・否認フロー | 拡張 |
| R11 | ステータス変更履歴の記録（否認理由含む） | 拡張 |

---

## 0.3 ドメインモデル（概念設計）

### エンティティ: Organization（組織）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| OrganizationId | UUID | 一意識別子（PK） |
| Name | string | 組織名 |
| Type | enum | Headquarters / Branch |
| ParentId | UUID? | 親組織ID（支部の場合、本部のIDを参照。本部はnull） |
| CreatedAt | datetime | 作成日時 |
| UpdatedAt | datetime | 更新日時 |

※ 本部（Headquarters）と支部（Branch）の1階層構造。

### エンティティ: User（ユーザー）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| UserId | UUID | 一意識別子（PK） |
| OrganizationId | UUID | 所属組織（FK） |
| Name | string | 氏名 |
| Email | string | メールアドレス（ログイン用、一意） |
| Role | enum | Admin / Supervisor / Worker |
| IsActive | boolean | 有効フラグ |
| CreatedAt | datetime | 作成日時 |
| UpdatedAt | datetime | 更新日時 |

※ ロール定義：
- **Admin（本部管理者）**: 支部のCRUD、ユーザー管理、全体統括。本部に所属。
- **Supervisor（現場監督）**: 指摘の登録（ReportedBy）、作業担当者への割り振り（Assignee設定）、是正完了の確認・否認。支部に所属。
- **Worker（作業担当者）**: 割り振られた是正作業の実施、完了報告。支部に所属。

### エンティティ: Building（建造物）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| BuildingId | UUID | 一意識別子（PK） |
| BranchId | UUID | 所属する支部（Organization FK） |
| Name | string | 建造物名 |
| Address | string | 住所 |
| Latitude | decimal | 緯度（Coordinate VO） |
| Longitude | decimal | 経度（Coordinate VO） |
| ModelUrn | string | APS BIMモデルURN（統合BIM、建造物単位で1URN） |
| CreatedAt | datetime | 作成日時 |
| UpdatedAt | datetime | 更新日時 |

### エンティティ: Floor（フロア）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| FloorId | UUID | 一意識別子（PK） |
| BuildingId | UUID | 所属する建造物（FK） |
| Name | string | フロア名（例: "1F", "B1F", "RF"） |
| FloorNumber | int | フロア番号（ソート・表示用） |
| CreatedAt | datetime | 作成日時 |
| UpdatedAt | datetime | 更新日時 |

※ フロア選択により3Dビューのフィルタリングと指摘一覧の絞り込みを行う。

### 集約ルート: Project（プロジェクト）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| ProjectId | UUID | 一意識別子（PK） |
| BranchId | UUID | 管理する支部（Organization FK） |
| BuildingId | UUID | 対象建造物（FK） |
| Name | string | プロジェクト名 |
| StartDate | date | 開始日 |
| DueDate | date | 終了予定日（納期） |
| Status | enum | Planning / Active / Completed |
| CreatedAt | datetime | 作成日時 |
| UpdatedAt | datetime | 更新日時 |

### 集約ルート: Issue（指摘）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| IssueId | UUID | 一意識別子（PK） |
| ProjectId | UUID | プロジェクト識別子（FK） |
| FloorId | UUID | 対象フロア（FK、フロア絞り込みに使用） |
| Title | string | 指摘タイトル |
| Description | text | 指摘内容 |
| IssueType | enum | 品質不良 / 安全不備 / 施工不備 / 設計変更 |
| Status | enum | PointOut / Open / InProgress / Done / Confirmed |
| LocationType | enum | DbId / WorldPosition（Location VO） |
| DbId | int? | Viewer要素ID（部材指摘時） |
| WorldPositionX | decimal? | X座標（空間指摘時） |
| WorldPositionY | decimal? | Y座標（空間指摘時） |
| WorldPositionZ | decimal? | Z座標（空間指摘時） |
| ReportedBy | UUID | 指摘者（User FK。Supervisorのみ登録可能） |
| AssigneeId | UUID? | 作業担当者（User FK。Supervisorが割り振る） |
| DueDate | date? | 是正期限 |
| CreatedAt | datetime | 作成日時 |
| UpdatedAt | datetime | 更新日時 |

**子エンティティ: Photo**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| PhotoId | UUID | 一意識別子（PK） |
| IssueId | UUID | 所属する指摘（FK） |
| BlobKey | string | ストレージキー |
| PhotoPhase | enum | Before（是正前）/ After（是正後）/ Rejection（否認時） |
| UploadedAt | datetime | アップロード日時 |

**子エンティティ: StatusChangeLog**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| LogId | UUID | 一意識別子（PK） |
| IssueId | UUID | 所属する指摘（FK） |
| FromStatus | enum | 変更前ステータス |
| ToStatus | enum | 変更後ステータス |
| ChangedBy | UUID | 変更者（User FK） |
| Comment | text? | コメント（否認時必須、その他任意） |
| ChangedAt | datetime | 変更日時 |

※ StatusChangeLogにより佐藤さんの要望「履歴を追いたい」に対応。否認理由も記録される。

### エンティティ間のリレーション

- Organization(HQ) 1 --- * Organization(Branch)
- Organization(Branch) 1 --- * Building
- Organization(Branch) 1 --- * Project
- Organization 1 --- * User
- Building 1 --- * Floor
- Building 1 --- * Project
- Project 1 --- * Issue
- Floor 1 --- * Issue
- Issue 1 --- * Photo
- Issue 1 --- * StatusChangeLog
- User 1 --- * Issue (ReportedBy)
- User 1 --- * Issue (Assignee)
- User 1 --- * StatusChangeLog (ChangedBy)

### 状態遷移ルール（ドメイン内に配置）

```
PointOut --> Open      : Assignee設定（Supervisorが担当者を割り振る）
Open --> InProgress    : 着手（Workerが作業開始）
InProgress --> Done    : 是正完了報告（是正後写真が1枚以上必要）
Done --> Confirmed     : Supervisorが確認・承認
Done --> Open          : 否認（Supervisorのコメント必須、写真は任意）
InProgress --> Open    : 差し戻し
Confirmed --> Open     : 再指摘（Supervisorのコメント必須）
```

※ 指摘作成時にAssigneeを同時設定した場合、PointOutをスキップしOpen状態で作成可能
※ Open --> Done の直接遷移は禁止（ビジネスルール）
※ PointOut --> InProgress の直接遷移は禁止（必ずAssignee設定を経由）
※ 否認時（Done-->Open, Confirmed-->Open）はStatusChangeLogにコメント必須

### 権限ルール（ドメイン内に配置）

| 操作 | 許可ロール | 条件 |
|------|-----------|------|
| Issue登録（ReportedBy） | Supervisor | - |
| Assignee割り振り | Supervisor | - |
| PointOut --> Open | Supervisor | Assignee設定 |
| Open --> InProgress | Worker, Supervisor | Workerは自身がAssigneeの場合のみ |
| InProgress --> Done | Worker, Supervisor | Workerは自身がAssigneeの場合のみ |
| Done --> Confirmed | Supervisor | - |
| Done --> Open（否認） | Supervisor | コメント必須、写真任意 |
| InProgress --> Open（差戻） | Supervisor | - |
| Confirmed --> Open（再指摘） | Supervisor | コメント必須 |
| 写真追加 | Supervisor, Worker | - |
| 支部CRUD | Admin | - |
| ユーザー管理 | Admin | - |

---

## 0.4 画面遷移・UI仕様

### 画面構成

1. **画面0: ログイン** - メールアドレス + パスワード。ロールに応じたリダイレクト
2. **画面A: 管理ダッシュボード（Admin専用）** - 支部一覧 / ユーザー管理
3. **画面1: プロジェクト一覧** - プロジェクト名 + 指摘合計件数を表示
4. **画面2: フロア一覧** - フロア名 + 指摘合計件数を表示
5. **画面3: 3Dビュー（メイン画面）** - 左: 3Dビュー（マーカー表示 + ピン登録操作）、右: 指摘一覧パネル（ステータスバッジ表示）
6. **画面4: 指摘詳細** - 指摘内容 + 写真表示 + ステータス変更 + Assignee設定 + ステータス変更履歴タブ

### 画面3: 3Dビュー画面の詳細仕様

**双方向ハイライト連動:**
- 指摘一覧の項目をマウスオーバー → 3Dビュー上の対応するマーカーがハイライト
- 3Dビュー上のマーカーをマウスオーバー → 指摘一覧の対応する指摘名がハイライト

**詳細への遷移:**
- マーカーをクリック → 指摘詳細（画面4）へ遷移
- 指摘一覧の指摘名をクリック → 指摘詳細（画面4）へ遷移

**新規指摘の登録:**
- PC: 3Dモデル上の部材をダブルクリック → 指摘登録フォームへ遷移
- スマホ/タブレット: 部材を長押し → 指摘登録フォームへ遷移
- ダブルクリック/長押しの採用理由: シングルクリックはビューの回転・選択操作と競合するため
- 指摘登録はSupervisorロールのユーザーのみ可能
- 登録時にAssignee（作業担当者）を同時設定可能（設定した場合PointOutをスキップ）

**マーカーのステータス表示:**
- マーカーの色でステータスを視覚的に区別（PointOut:灰, Open:青, InProgress:黄, Done:緑, Confirmed:紫）

**空間指摘について:**
- 今回は部材指摘（dbId）のみ実装する
- 空間指摘（worldPosition）はNice to haveであることを担当者に確認済み
- ドメインモデル上はLocation Value Objectで両対応の構造を維持

---

## 0.5 技術選定

### 選定方針
- Arent社主力スタックに合わせる（Next.js + .NET）
- ただし課題の制約を考慮し、Next.js単体構成も選択肢

### 選定案

| レイヤー | 技術 | 理由 |
|---------|------|------|
| Frontend | Next.js (App Router) + TypeScript | Arent社主力。APS Viewer SDKとの親和性 |
| Backend | Next.js API Routes (Route Handlers) | BFF構成。設計上はレイヤー分離を担保 |
| DB | PostgreSQL | Docker対応容易。課題例示にもあり |
| Blob Storage | MinIO | S3互換。課題例示にもあり |
| ORM | Prisma | TypeScript親和性。Repository抽象化の実装基盤 |
| 認証 | NextAuth.js (Auth.js) | Credentials Providerでメール+パスワード認証 |

### 代替案との比較判断
- **Next.js + .NET分離構成**: 設計品質は高いが実装リスク大。READMEで言語化する方が評価に繋がる
- **Blazor構成**: APS Viewer SDK（JavaScript）との統合が煩雑

---

## 0.6 アーキテクチャ方針

### レイヤー構成（Onion Architecture簡略版）

| 層 | 責務 | 実装 |
|----|------|------|
| Presentation（UI） | 画面表示、APS Viewer統合 | Next.js Pages / Components / Viewer SDK |
| Application（UseCase） | ユースケース実行、認可チェック | Command / Query ハンドラ、DTO定義 |
| Domain（ビジネスルール） | 状態遷移、バリデーション、権限ルール | Issue集約、Value Objects、Repository Interface |
| Infrastructure（外部依存） | DB、Blob、APS Token、認証 | Prisma実装、MinIO Client、具象Repository |

### 依存方向
```
Presentation --> Application --> Domain <-- Infrastructure
```
- Domain層は他のどの層にも依存しない
- Infrastructure層はDomain層のインターフェースを実装する（依存性逆転）

### CQRS的整理
| 種別 | 責務 | 実装 |
|------|------|------|
| Command | Issue作成、ステータス変更、写真追加、Assignee設定、組織CRUD、ユーザーCRUD | Domain集約を経由。整合性を担保 |
| Query | 指摘一覧取得、指摘詳細取得、ステータス変更履歴取得、組織一覧、ユーザー一覧 | DBから直接読み取り。集約を経由しない |

件数増加時の方針: Query側は将来的にRead Model（Materialized View/検索用テーブル）を分離可能な構造にしておく。

---

## 0.7 永続化戦略

### DB設計方針
- Issue集約をそのまま1テーブル + Photos子テーブル + StatusChangeLogs子テーブルに写像
- Location情報はIssueテーブル内にlocationType + dbId + worldPositionX/Y/Zカラム
- Organization（組織）はself-referencing FK（parent_id）で本部→支部の階層を表現
- StatusChangeLogテーブルでIssueの全状態変更履歴を保持（否認コメント含む）

### Blob保存戦略
- キー命名: `projects/{projectId}/issues/{issueId}/photos/{photoId}.{ext}`
- DB側にはBlobKeyのみ保持（URLは動的生成）

### DBとBlobの整合性
- 写真アップロードフロー: (1) Blob保存 → (2) DB記録（BlobKey）
- 失敗時: Blobに孤立ファイルが残る可能性あり → 定期クリーンアップジョブで対応
- 逆順（DB先）だとDBにキーがあるのにファイルがない状態が危険なので、Blob先を採用

---

## 0.8 外部依存の隔離

### APS依存
- Domain層: ViewerTokenProvider インターフェースのみ定義
- Infrastructure層: ApsViewerTokenProvider が2-legged OAuthで具象実装
- Viewer SDK自体はフロントエンドで直接利用（UIの関心事）

### ストレージ依存
- Domain層: PhotoStorage インターフェース（upload, getUrl）
- Infrastructure層: MinioPhotoStorage が具象実装

### 認証依存
- Domain層: AuthProvider インターフェース（authenticate, getCurrentUser）
- Infrastructure層: NextAuthProvider が具象実装

---

## 0.9 ディレクトリ構成案

```
/
+-- docker-compose.yml
+-- README.md
+-- docs/
|   +-- architecture.md
|   +-- architecture.mmd
|   +-- er-diagram.mmd
|   +-- api-design.md
+-- src/
|   +-- domain/
|   |   +-- models/
|   |   |   +-- organization.ts
|   |   |   +-- user.ts
|   |   |   +-- building.ts
|   |   |   +-- floor.ts
|   |   |   +-- project.ts
|   |   |   +-- issue.ts
|   |   |   +-- photo.ts
|   |   |   +-- status-change-log.ts
|   |   |   +-- location.ts
|   |   |   +-- coordinate.ts
|   |   +-- repositories/
|   |   +-- services/
|   |   +-- errors/
|   +-- application/
|   |   +-- commands/
|   |   +-- queries/
|   |   +-- dto/
|   +-- infrastructure/
|   |   +-- prisma/
|   |   +-- minio/
|   |   +-- aps/
|   |   +-- auth/
|   +-- app/
|       +-- api/
|       +-- components/
|       +-- (pages)/
+-- prisma/
|   +-- schema.prisma
+-- .env.example
```

---

## 0.10 API設計（概要）

### Organization（組織）
| Method | Path | 責務 | 種別 | 権限 |
|--------|------|------|------|------|
| GET | /api/organizations | 組織一覧取得 | Query | Admin |
| POST | /api/organizations | 支部作成 | Command | Admin |
| PATCH | /api/organizations/{id} | 支部更新 | Command | Admin |
| DELETE | /api/organizations/{id} | 支部削除 | Command | Admin |

### User（ユーザー）
| Method | Path | 責務 | 種別 | 権限 |
|--------|------|------|------|------|
| GET | /api/users | ユーザー一覧取得 | Query | Admin |
| POST | /api/users | ユーザー作成 | Command | Admin |
| PATCH | /api/users/{id} | ユーザー更新 | Command | Admin |
| DELETE | /api/users/{id} | ユーザー無効化 | Command | Admin |

### Auth（認証）
| Method | Path | 責務 | 種別 | 権限 |
|--------|------|------|------|------|
| POST | /api/auth/login | ログイン | Command | - |
| POST | /api/auth/logout | ログアウト | Command | 認証済み |
| GET | /api/auth/me | 現在のユーザー取得 | Query | 認証済み |

### Building / Floor
| Method | Path | 責務 | 種別 | 権限 |
|--------|------|------|------|------|
| GET | /api/buildings | 建造物一覧取得 | Query | 認証済み |
| GET | /api/buildings/{buildingId}/floors | フロア一覧取得 | Query | 認証済み |

### Project
| Method | Path | 責務 | 種別 | 権限 |
|--------|------|------|------|------|
| GET | /api/projects | プロジェクト一覧取得 | Query | 認証済み |
| GET | /api/projects/{id} | プロジェクト詳細取得 | Query | 認証済み |

### Viewer
| Method | Path | 責務 | 種別 | 権限 |
|--------|------|------|------|------|
| GET | /api/viewer/token | APSアクセストークン取得 | Query | 認証済み |

### Issue
| Method | Path | 責務 | 種別 | 権限 |
|--------|------|------|------|------|
| POST | /api/projects/{id}/issues | 指摘作成（Assignee同時設定可） | Command | Supervisor |
| GET | /api/projects/{id}/issues | 指摘一覧取得（?floorId=&status=） | Query | 認証済み |
| GET | /api/projects/{id}/issues/{issueId} | 指摘詳細取得（StatusChangeLog含む） | Query | 認証済み |
| PATCH | /api/projects/{id}/issues/{issueId}/status | ステータス変更 | Command | Supervisor, Worker※ |
| PATCH | /api/projects/{id}/issues/{issueId}/assignee | 作業担当者割り振り | Command | Supervisor |
| POST | /api/projects/{id}/issues/{issueId}/photos | 写真アップロード | Command | Supervisor, Worker |
| GET | /api/photos/{photoId}/url | 写真URL取得（署名付き） | Query | 認証済み |

※ Workerは自身がAssigneeの場合のみ、Open-->InProgress / InProgress-->Done の遷移が可能
※ ステータス変更APIのリクエストボディ: { newStatus, comment?, photoIds? }
※ Done-->Open（否認）、Confirmed-->Open（再指摘）時はcommentが必須

---

## 0.11 実装フェーズ計画

| Phase | 内容 | 見積 |
|-------|------|------|
| **Phase 0** | 要件構造化・設計・本ドキュメント | 3h |
| **Phase 1** | Docker環境構築（PostgreSQL + MinIO） | 1h |
| **Phase 2** | Domain層実装（全集約・状態遷移・権限ルール・StatusChangeLog・VOs） | 3h |
| **Phase 3** | Infrastructure層（Prisma + シードデータ + MinIO + APS + Auth） | 2.5h |
| **Phase 4** | Application層（Command/Queryハンドラ + 認可チェック） | 2.5h |
| **Phase 5** | API Routes実装（認証ミドルウェア含む） | 2h |
| **Phase 6** | Viewer統合 + ピン登録UI | 2h |
| **Phase 7** | 指摘入力/一覧/位置遷移UI + ロール別UI制御 + 履歴表示 | 3h |
| **Phase 8** | 管理ダッシュボード（Admin: 支部・ユーザーCRUD） | 2h |
| **Phase 9** | README・設計資料・図の整備 | 1.5h |
| **合計** | | **22.5h** |

---

## 0.12 将来本番構成（README記載用メモ）

| 観点 | 方針 |
|------|------|
| クラウド | Azure: App Service + Azure SQL + Azure Blob Storage / AWS: ECS + RDS + S3 |
| 認証 | Azure AD B2C or Auth0。現場ユーザーはメール招待ベース。SSO対応 |
| マルチテナント | OrganizationにTenantId付与。RLS or アプリ層でのテナント分離 |
| ロール・割振り | Admin/Supervisor/Workerの3ロール。SupervisorがAssigneeを割り振り |
| 大量データ | Query側にRead Model分離。ページネーション + フィルタインデックス |
| Blob | CDN経由配信。サムネイル自動生成（Azure Functions / Lambda） |
| マスタ管理 | Organization/Building/Floor/ProjectのCRUD管理画面 |
| 監査ログ | StatusChangeLogテーブル。将来的にはAuditLogに統合 |
| 通知 | ステータス変更時にメール or Push通知。否認時は理由を通知本文に含める |

---

## 0.13 設計判断の記録（ADR的メモ）

### 判断1: Next.js単体 vs Next.js + .NET分離
- **決定**: Next.js単体
- **理由**: 設計上のレイヤー分離はディレクトリ構成で担保。READMEで「本番では.NETバックエンドに分離する想定」と明記。

### 判断2: 写真のBlobKey方式 vs URL直接保存
- **決定**: BlobKey方式
- **理由**: ストレージ移行時にURLが変わる。署名付きURL生成を動的に行うことでセキュリティも担保。

### 判断3: Location情報のDB格納方法
- **決定**: Issueテーブル内にlocationType + dbId + worldPositionX/Y/Zカラム
- **理由**: JSON列はクエリ性能に課題。正規化カラムならインデックス利用可能。

### 判断4: 状態遷移ルールの配置場所
- **決定**: Domain層（Issue集約内のメソッド）
- **理由**: ビジネスルールはドメインに閉じ込める。Application層はオーケストレーションのみ。

### 判断5: 組織・ユーザー・ロールの導入
- **決定**: Organization（本部/支部）、User（Admin/Supervisor/Worker）を導入する。
- **理由**: ヒアリングメモから「指摘者と是正作業者は別」「協力会社も探し回る」という課題が読み取れる。実運用では「誰が指摘し、誰が是正するか」の明確化が不可欠。
- **経緯**: Arent担当者にSlackで拡張の妥当性を確認したが、回答が得られなかったため、PM判断で進めた。

### 判断6: 5段階ステータスの導入（PointOut/Open/InProgress/Done/Confirmed）
- **決定**: 最低要件の3段階（Open/InProgress/Done）を5段階に拡張する。
- **理由**: 実運用では「指摘を出したがまだ担当者未定」（PointOut）と「是正完了を監督が確認済み」（Confirmed）の区別が不可欠。特に否認フロー（Done-->Open）は、是正品質を担保するための重要なビジネスルール。否認時にSupervisorのコメントを必須としたのは、Workerが「何が不十分か」を明確に把握し再作業できるようにするため。

### 判断7: StatusChangeLog（状態変更履歴）の導入
- **決定**: IssueのStatusChangeをStatusChangeLogとして記録する。
- **理由**: 佐藤さんの「履歴も追いたい」という要望に直接対応。否認理由の記録にも利用。

### 判断8: Building/Floor/Projectの管理
- **決定**: Admin向け管理ダッシュボードでCRUD操作を提供。最低要件版ではシードデータで代替。

### 判断9: BIMモデルURN（ModelUrn）の配置場所
- **決定**: Building（建造物）エンティティに配置。
- **理由**: 1つの建造物に対して1つの統合モデルが存在する構造。フロア選択はViewer側のフィルタリングで対応。

### 判断10: 空間指摘（worldPosition）を今回実装しない
- **決定**: 部材指摘（dbId）のみ実装。空間指摘は実装しない。
- **理由**: Nice to have確認済み。ドメインモデル上はLocation VOで両対応の構造を維持。

### 判断11: 認可の実装場所
- **決定**: Application層で認可チェック（ロール検証）、Domain層で権限ルール定義。
- **理由**: 「誰が何をできるか」はビジネスルール。Presentation層では認証のみ、認可はApplication層に委譲。

### 判断12: Organization構造を1階層（本部→支部）に限定
- **決定**: 再帰的な多階層ではなく、本部と支部の1階層構造。
- **理由**: 建設業界では「本社/支社→現場」の2階層が一般的。将来的にはClosure Tableパターンで対応可能。

### 判断13: PointOutスキップの許可
- **決定**: 指摘作成時にAssigneeを同時設定した場合、PointOutをスキップしOpen状態で作成可能。
- **理由**: Supervisorが担当者を既に把握している場合、PointOut-->Openの2ステップは冗長。両方のワークフローに対応することで現場の柔軟性を担保。
