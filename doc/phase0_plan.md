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
| R3 | 指摘の状態管理（Open → In Progress → Done） | 必須 |
| R4 | 一覧から3D上の該当箇所へ即座に遷移できる | 必須 |
| R5 | APS Viewerで3Dモデルを表示 | 必須 |
| R6 | 3Dモデル上にピンを登録できる | 必須 |

---

## 0.3 ドメインモデル（概念設計）

### エンティティ: Building（建造物）
```
Building（建造物）
├── BuildingId       : 一意識別子
├── Name             : 建造物名
├── Address          : 住所
├── Coordinate       : 座標（Value Object）
│   ├── Latitude     : 緯度
│   └── Longitude    : 経度
├── ModelUrn         : APS BIMモデルURN（統合BIM、建造物単位で1URN）
├── Floors[]         : フロアコレクション
├── CreatedAt        : 作成日時
└── UpdatedAt        : 更新日時
```

### エンティティ: Floor（フロア）
```
Floor（フロア）
├── FloorId          : 一意識別子
├── BuildingId       : 所属する建造物
├── Name             : フロア名（例: "1F", "B1F", "RF"）
├── FloorNumber      : フロア番号（ソート・表示用。例: -1, 1, 2, ...）
├── CreatedAt        : 作成日時
└── UpdatedAt        : 更新日時
```
※ ワイヤーフレームの「フロアをプルダウンから選択」に対応。フロア選択により3Dビューのフィルタリングと指摘一覧の絞り込みを行う。

### 集約ルート: Project（プロジェクト）
```
Project（プロジェクト）
├── ProjectId        : 一意識別子
├── Name             : プロジェクト名
├── BuildingId       : 対象建造物
├── StartDate        : 開始日
├── DueDate          : 終了予定日（納期）
├── Status           : 状態（Planning/Active/Completed）
├── CreatedAt        : 作成日時
└── UpdatedAt        : 更新日時
```
※ ProjectMember（プロジェクトメンバー）は拡張フェーズでロール導入と合わせて追加予定（ADR判断5参照）。

### 集約ルート: Issue（指摘）
```
Issue（指摘）
├── IssueId          : 一意識別子
├── ProjectId        : プロジェクト識別子
├── FloorId          : 対象フロア（フロア絞り込みに使用）
├── Title            : 指摘タイトル
├── Description      : 指摘内容
├── IssueType        : 種別（品質不良/安全不備/施工不備/設計変更）
├── Status           : 状態（Open/InProgress/Done）
├── Location         : 位置情報（Value Object）
│   ├── LocationType : 部材指摘(DbId) or 空間指摘(WorldPosition)
│   ├── DbId?        : Viewer要素ID（部材指摘時）
│   └── WorldPosition? : {x, y, z}（空間指摘時）
├── Photos[]         : 写真コレクション
│   ├── PhotoId
│   ├── BlobKey      : ストレージキー
│   ├── PhotoPhase   : 是正前(Before) / 是正後(After)
│   └── UploadedAt
├── ReportedBy       : 指摘者（指摘を登録した人。作業者とは別）
├── CreatedAt        : 作成日時
└── UpdatedAt        : 更新日時
```
※ Assignee（作業担当者）は最低要件には含めない。拡張フェーズでロール導入と合わせて追加予定（ADR判断5参照）。

### エンティティ間のリレーション
```
Building 1 ─── * Floor
Building 1 ─── * Project
Project  1 ─── * Issue
Floor    1 ─── * Issue
Issue    1 ─── * Photo
```

### 状態遷移ルール（ドメイン内に配置）
```
Open → InProgress : 着手
InProgress → Done : 是正完了（是正後写真が1枚以上必要、というルールを検討）
InProgress → Open : 差し戻し
Done → InProgress : 再指摘（再オープン）
```
※ `Open → Done` の直接遷移は禁止（ビジネスルール）

---

## 0.4 画面遷移・UI仕様

### 画面構成
```
[画面1] プロジェクト一覧
    │  プロジェクト名 + 指摘合計件数を表示
    │  プロジェクトをクリック
    ▼
[画面2] フロア一覧
    │  フロア名 + 指摘合計件数を表示
    │  フロアをクリック
    ▼
[画面3] 3Dビュー（メイン画面）
    │  左: 3Dビュー（マーカー表示 + ピン登録操作）
    │  右: 指摘一覧パネル
    │  マーカー or 指摘名をクリック
    ▼
[画面4] 指摘詳細
    │  指摘内容 + 写真表示 + ステータス変更
```

### 画面3: 3Dビュー画面の詳細仕様

**双方向ハイライト連動:**
- 指摘一覧の項目をマウスオーバー → 3Dビュー上の対応するマーカーがハイライト
- 3Dビュー上のマーカーをマウスオーバー → 指摘一覧の対応する指摘名がハイライト

**詳細への遷移:**
- マーカーをクリック → 指摘詳細（画面4）へ遷移
- 指摘一覧の指摘名をクリック → 指摘詳細（画面4）へ遷移
- どちらの導線でも同じ詳細画面に到達する

**新規指摘の登録:**
- PC: 3Dモデル上の部材をダブルクリック → 指摘登録フォームへ遷移
- スマホ/タブレット: 部材を長押し → 指摘登録フォームへ遷移
- ダブルクリック/長押しの採用理由: シングルクリックはビューの回転・選択操作と競合するため、誤操作防止

**空間指摘について:**
- 今回は部材指摘（dbId）のみ実装する
- 空間指摘（worldPosition）はNice to haveであることを担当者に確認済み
- 将来的にはコンテキストメニューから空間ピン登録を追加可能な設計とする
- ドメインモデル上はLocation Value Objectで両対応の構造を維持（課題資料4.3「両対応が望ましい」に対する設計的備え）

---

## 0.5 技術選定

### 選定方針
- Arent社主力スタックに合わせる（Next.js + .NET）
- ただし16時間の制約を考慮し、Next.js単体構成も選択肢

### 選定案

| レイヤー | 技術 | 理由 |
|---------|------|------|
| Frontend | Next.js (App Router) + TypeScript | Arent社主力。APS Viewer SDKとの親和性 |
| Backend | Next.js API Routes (Route Handlers) | 16h制約でBFF構成。設計上はレイヤー分離を担保 |
| DB | PostgreSQL | Docker対応容易。課題例示にもあり |
| Blob Storage | MinIO | S3互換。課題例示にもあり |
| ORM | Prisma | TypeScript親和性。Repository抽象化の実装基盤 |
| 認証 | なし（Phase 0では割愛。将来設計としてREADMEに記載） |

### 代替案との比較判断
- **Next.js + .NET分離構成**: 設計品質は高いが、16hでの実装リスク大。README上で「本番ではこうする」と言語化する方が評価に繋がる
- **Blazor構成**: APS Viewer SDK（JavaScript）との統合が煩雑

---

## 0.6 アーキテクチャ方針

### レイヤー構成（Onion Architecture簡略版）
```
┌─────────────────────────────────────┐
│  Presentation（UI）                  │  Next.js Pages / Components
│  └─ APS Viewer統合                  │  Viewer SDK呼び出し
├─────────────────────────────────────┤
│  Application（UseCase）              │  Command / Query ハンドラ
│  └─ CreateIssue, UpdateStatus, ...  │  DTO定義
├─────────────────────────────────────┤
│  Domain（ビジネスルール）              │  Issue集約, Value Objects
│  └─ 状態遷移, バリデーション           │  Repository Interface
├─────────────────────────────────────┤
│  Infrastructure（外部依存）            │  Prisma実装, MinIO Client
│  └─ DB, Blob, APS Token取得         │  具象Repository
└─────────────────────────────────────┘
```

### 依存方向
```
Presentation → Application → Domain ← Infrastructure
```
- Domain層は他のどの層にも依存しない
- Infrastructure層はDomain層のインターフェースを実装する（依存性逆転）

### CQRS的整理
| 種別 | 責務 | 実装 |
|------|------|------|
| Command | Issue作成、ステータス変更、写真追加 | Domain集約を経由。整合性を担保 |
| Query | 指摘一覧取得、指摘詳細取得 | DBから直接読み取り。集約を経由しない |

件数増加時の方針: Query側は将来的にRead Model（Materialized View/検索用テーブル）を分離可能な構造にしておく。

---

## 0.7 永続化戦略

### DB設計方針
- Issue集約をそのまま1テーブル + Photos子テーブルに写像
- Location情報はIssueテーブル内にJSON列 or カラム分割

### Blob保存戦略
- キー命名: `projects/{projectId}/issues/{issueId}/photos/{photoId}.{ext}`
- DB側にはBlobKeyのみ保持（URLは動的生成）

### DBとBlobの整合性
- 写真アップロードフロー: ① Blob保存 → ② DB記録（BlobKey）
- 失敗時: Blobに孤立ファイルが残る可能性あり → 定期クリーンアップジョブで対応（本番設計としてREADMEに記載）
- 逆順（DB先）だとDBにキーがあるのにファイルがない状態が危険なので、Blob先を採用

---

## 0.8 外部依存の隔離

### APS依存
```typescript
// Domain層: インターフェースのみ
interface ViewerTokenProvider {
  getAccessToken(): Promise<{ token: string; expiresIn: number }>;
}

// Infrastructure層: 具象実装
class ApsViewerTokenProvider implements ViewerTokenProvider {
  // 2-legged OAuthでトークン取得
}
```
- Viewer SDK自体はフロントエンドで直接利用（UIの関心事）
- トークン取得のみバックエンド経由で隔離

### ストレージ依存
```typescript
// Domain層: インターフェース
interface PhotoStorage {
  upload(key: string, file: Buffer, contentType: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}

// Infrastructure層: MinIO具象実装
class MinioPhotoStorage implements PhotoStorage { ... }
```

---

## 0.9 ディレクトリ構成案

```
/
├── docker-compose.yml
├── README.md
├── docs/
│   ├── architecture.md        # アーキテクチャ説明
│   ├── architecture.mmd       # Mermaid図
│   ├── er-diagram.mmd         # ER図
│   └── api-design.md          # API設計
├── src/
│   ├── domain/                # ドメイン層
│   │   ├── models/
│   │   │   ├── building.ts    # Building エンティティ
│   │   │   ├── floor.ts       # Floor エンティティ
│   │   │   ├── project.ts     # Project 集約
│   │   │   ├── issue.ts       # Issue 集約
│   │   │   ├── photo.ts       # Photo エンティティ
│   │   │   ├── location.ts    # Location Value Object
│   │   │   └── coordinate.ts  # Coordinate Value Object（建造物の緯度経度）
│   │   ├── repositories/      # Repositoryインターフェース
│   │   └── errors/            # ドメインエラー
│   ├── application/           # アプリケーション層
│   │   ├── commands/          # 書き込み系UseCase
│   │   ├── queries/           # 読み取り系UseCase
│   │   └── dto/               # データ転送オブジェクト
│   ├── infrastructure/        # インフラ層
│   │   ├── prisma/            # DB実装
│   │   ├── minio/             # Blob実装
│   │   └── aps/               # APSトークン取得
│   ├── api/
│   │   └── utils/             # 共通APIエラーハンドリング
│   ├── types/                 # 外部SDK型定義（forge-viewer等）
│   └── app/                   # Next.js Presentation層
│       ├── api/               # Route Handlers
│       ├── components/        # UIコンポーネント
│       └── (pages)/           # ページ
├── prisma/
│   └── schema.prisma
└── .env.example
```

---

## 0.10 API設計（概要）

### Building / Floor
| Method | Path | 責務 | 種別 |
|--------|------|------|------|
| GET | /api/buildings | 建造物一覧取得 | Query |
| GET | /api/buildings/{buildingId}/floors | フロア一覧取得 | Query |

### Project
| Method | Path | 責務 | 種別 |
|--------|------|------|------|
| GET | /api/projects | プロジェクト一覧取得 | Query |
| GET | /api/projects/{id} | プロジェクト詳細取得 | Query |

### Viewer
| Method | Path | 責務 | 種別 |
|--------|------|------|------|
| GET | /api/viewer/token | APSアクセストークン取得 | Query |

### Issue
| Method | Path | 責務 | 種別 |
|--------|------|------|------|
| POST | /api/projects/{id}/issues | 指摘作成（ピン登録含む） | Command |
| GET | /api/projects/{id}/issues | 指摘一覧取得（?floorId= でフロア絞り込み） | Query |
| GET | /api/projects/{id}/issues/{issueId} | 指摘詳細取得 | Query |
| PATCH | /api/projects/{id}/issues/{issueId}/status | ステータス変更 | Command |
| POST | /api/projects/{id}/issues/{issueId}/photos | 写真アップロード | Command |
| GET | /api/photos/{photoId}/url | 写真URL取得（署名付き） | Query |

※ Building/Floor/Projectの作成・更新APIは最低要件ではシード（初期）データで代替。管理画面は拡張フェーズで検討。

---

## 0.11 実装フェーズ計画

| Phase | 内容 | 見積 |
|-------|------|------|
| **Phase 0** | 要件構造化・設計・本ドキュメント | 3h |
| **Phase 1** | Docker環境構築（PostgreSQL + MinIO） | 1h |
| **Phase 2** | Domain層実装（Building/Floor/Project/Issue集約・状態遷移・VOs） | 2h |
| **Phase 3** | Infrastructure層（Prisma + シードデータ + MinIO + APS） | 2h |
| **Phase 4** | Application層（Command/Queryハンドラ） | 2h |
| **Phase 5** | API Routes実装 | 1.5h |
| **Phase 6** | Viewer統合 + ピン登録UI | 2h |
| **Phase 7** | 指摘入力/一覧/位置遷移UI | 2h |
| **Phase 8** | README・設計資料・図の整備 | 1.5h |
| **合計** | | **17h**（バッファ消費で16h目標） |

---

## 0.12 将来本番構成（README記載用メモ）

| 観点 | 方針 |
|------|------|
| クラウド | Azure: App Service + Azure SQL + Azure Blob Storage / AWS: ECS + RDS + S3 |
| 認証 | Azure AD B2C or Auth0。現場ユーザーはメール招待ベース |
| マルチユーザー | ProjectにTenantId付与。RLS or アプリ層でのテナント分離 |
| ロール・割振り | 指摘者(Reporter)・管理者(Manager)・作業者(Worker)の3ロール導入。IssueにAssignee（作業担当者）フィールドを追加し、管理者が作業者に指摘を割り振るワークフローを実装。ヒアリングでの「協力会社も探し回る」という課題に対応 |
| 大量データ | Query側にRead Model分離。指摘一覧はページネーション + フィルタインデックス |
| Blob | CDN経由配信。サムネイル自動生成（Azure Functions / Lambda） |
| マスタ管理 | Building/Floor/ProjectのCRUD管理画面。最低要件ではシードデータで代替しているが、本番ではBuildingに施工者・発注者・構造種別等の詳細情報を追加し、管理UIから操作可能にする |

---

## 0.13 設計判断の記録（ADR的メモ）

### 判断1: Next.js単体 vs Next.js + .NET分離
- **決定**: Next.js単体
- **理由**: 16h制約。設計上のレイヤー分離はディレクトリ構成で担保。READMEで「本番では.NETバックエンドに分離する想定」と明記。

### 判断2: 写真のBlobKey方式 vs URL直接保存
- **決定**: BlobKey方式
- **理由**: ストレージ移行時にURLが変わる。署名付きURL生成を動的に行うことでセキュリティも担保。

### 判断3: Location情報のDB格納方法
- **決定**: Issueテーブル内にlocationType + dbId + worldPositionX/Y/Zカラム
- **理由**: JSON列はクエリ性能に課題。正規化カラムならインデックス利用可能。

### 判断4: 状態遷移ルールの配置場所
- **決定**: Domain層（Issue集約内のメソッド）
- **理由**: ビジネスルールはドメインに閉じ込める。Application層はオーケストレーションのみ。

### 判断5: Assignee（作業担当者）を最低要件に含めない
- **決定**: 最低要件のIssue構造にはAssigneeを含めない。将来設計（8.6）として記載する。
- **理由**: 課題資料のワイヤーフレームにAssigneeフィールドは定義されていない。ヒアリングメモから「指摘者と是正作業者は別」という示唆は読み取れるが、ロール体系やワークフローは資料の要求範囲を超える。まず資料に忠実な最低要件を満たした後、拡張フェーズとしてArent担当者にSlackで確認のうえ着手する方針。
- **進め方**: Phase 1〜8で最低要件を完成 → Arentに「実運用を見据えたロール・割振り機能の追加を検討しているが妥当か？」と確認 → 承認後に拡張実装。

### 判断6: Building/Floor/Projectの最低要件での扱い
- **決定**: 作成・更新APIは実装せず、Prismaのシード（初期データ）で投入する。参照APIのみ実装。
- **理由**: 課題の最低要件は指摘管理のCRUDに集中している。マスタデータの管理UIは評価対象外と判断。ただしドメインモデルとしては正しく定義し、将来のCRUD追加に備える。

### 判断7: BIMモデルURN（ModelUrn）の配置場所
- **決定**: Building（建造物）エンティティに配置。
- **理由**: 資料に「建築＋設備統合BIM」「3Dビューのみ」とあり、1つの建造物に対して1つの統合モデルが存在する構造。フロア単位でURNを分けるケースも将来ありうるが、現時点の資料ではそこまで要求されていない。フロア選択はViewer側のフィルタリング（セクションボックス等）で対応する。

### 判断8: 空間指摘（worldPosition）を今回実装しない
- **決定**: 最低要件では部材指摘（dbId）のみ実装する。空間指摘は実装しない。
- **理由**: 担当者にNice to haveであることを確認済み。ただし課題資料4.3に「両対応が望ましい」と明記されているため、ドメインモデル上はLocation Value Objectで部材・空間両方の構造を定義し、将来追加時にドメイン変更が不要な設計を維持する。
- **将来の追加方式**: 3Dビュー上のコンテキストメニュー（右クリック）から「空間ピンを登録」を選択し、クリック地点のworldPositionを取得して指摘を作成する導線を想定。
