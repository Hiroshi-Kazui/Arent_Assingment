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
| R12 | ロール別の画面遷移・表示範囲制御（Admin全権限/Supervisor支部内全体/Worker自担当のみ） | 拡張 |
| R13 | プロジェクト単位の進捗率表示（指摘ステータスベースの自動算出） | 拡張 |

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
※ **本部はシステム全体で1社のみ**。シーダで初期登録し、アプリからは追加・変更不可。
※ アプリから作成できる組織は Branch（支部）のみ。新規支部作成時に Type=Headquarters を指定することは禁止する（バリデーションエラー）。

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
- **Admin（本部管理者）**: 支部CRUD、ユーザー管理、全支部・全プロジェクトの閲覧・指摘登録・プロジェクト登録/編集。本部に所属。
- **Supervisor（現場監督）**: 所属支部のプロジェクト全体を管理。指摘の登録（ReportedBy）、作業担当者への割り振り（Assignee設定）、是正完了の確認・否認。支部に所属。プロジェクト情報は閲覧のみ。
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
| Elevation | decimal? | 標高（mm）。Viewer BoundingBox Zから推定（判断17参照） |
| CreatedAt | datetime | 作成日時 |
| UpdatedAt | datetime | 更新日時 |

※ フロア選択は3Dビュー画面内のプルダウンで行い、3Dビューのフィルタリングと指摘一覧の絞り込みを実行する。
※ FloorデータはAPS Model Derivative APIのメタデータから自動生成する（手動定義しない。判断17参照）。

### 集約ルート: Project（プロジェクト）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| ProjectId | UUID | 一意識別子（PK） |
| BranchId | UUID | 管理する支部（Organization FK） |
| BuildingId | UUID | 対象建造物（FK） |
| Name | string | プロジェクト名 |
| Plan | text | 計画内容（自由記述テキスト） |
| StartDate | date | 開始日 |
| DueDate | date | 終了予定日（納期） |
| Status | enum | Planning / Active / Completed |
| CreatedAt | datetime | 作成日時 |
| UpdatedAt | datetime | 更新日時 |

※ Planフィールド: プロジェクトの工事計画・概要を自由記述で管理。Admin権限でのみ登録・編集可能。

#### 進捗率（ProgressRate）の算出ルール
進捗率はProjectの永続化フィールドではなく、Query時に算出する導出値（Derived Value）。

**算出式:**
```
各指摘のスコア:
  Done = 50%
  Confirmed = 100%
  それ以外（PointOut / Open / InProgress） = 0%

進捗率 = 全指摘スコアの平均
指摘が0件の場合 = 0%
```

**例:** 指摘5件（PointOut×1, Open×1, InProgress×1, Done×1, Confirmed×1）の場合
→ (0 + 0 + 0 + 50 + 100) / 5 = 30%

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

### エンティティ: ElementFloorMapping（部材フロアマッピング）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| BuildingId | UUID | 建造物ID（複合PK） |
| DbId | int | Viewer部材ID（複合PK） |
| FloorId | UUID | 判定されたフロア（FK） |
| BoundingBoxMinZ | decimal | 判定に使用した底面Z値（検証・デバッグ用） |
| CreatedAt | datetime | 作成日時 |
| UpdatedAt | datetime | 更新日時 |

※ BIMモデルのlevelプロパティは信頼できない（実データで不正確な値を確認済み。判断16参照）。
※ フロア判定はBoundingBox底面Z座標のみで行う（判断17参照）。参照レベルプロパティはモデル作成者依存のため使用しない。
※ Viewer起動時に動的構築し、非同期でバックエンドに永続化する（事前バッチ登録ではない）。
※ 空間指摘（worldPosition）の場合はElementFloorMappingを使わず、Floor.Elevationを参照してZ座標からリアルタイム判定する。
※ 指摘登録時、部材ダブルクリック → dbIdからElementFloorMappingを引いてFloorIdを自動設定する。

### エンティティ間のリレーション

- Organization(HQ) 1 --- * Organization(Branch)
- Organization(Branch) 1 --- * Building
- Organization(Branch) 1 --- * Project
- Organization 1 --- * User
- Building 1 --- * Floor
- Building 1 --- * Project
- Building 1 --- * ElementFloorMapping
- Floor 1 --- * ElementFloorMapping
- Project 1 --- * Issue
- Floor 1 --- * Issue
- Issue 1 --- * Photo
- Issue 1 --- * StatusChangeLog
- User 1 --- * Issue (ReportedBy)
- User 1 --- * Issue (Assignee)
- User 1 --- * StatusChangeLog (ChangedBy)

### 状態遷移ルール（ドメイン内に配置）

```
PointOut --> Open      : Assignee設定（Admin/Supervisorが担当者を割り振る）
Open --> InProgress    : 着手（Workerが作業開始）
InProgress --> Done    : 是正完了報告（是正後写真が1枚以上必要）
Done --> Confirmed     : Admin/Supervisorが確認・承認
Done --> Open          : 否認（Admin/Supervisorのコメント必須、写真は任意）
InProgress --> Open    : 差し戻し
Confirmed --> Open     : 再指摘（Admin/Supervisorのコメント必須）
```

※ 指摘作成時にAssigneeを同時設定した場合、PointOutをスキップしOpen状態で作成可能
※ Open --> Done の直接遷移は禁止（ビジネスルール）
※ PointOut --> InProgress の直接遷移は禁止（必ずAssignee設定を経由）
※ 否認時（Done-->Open, Confirmed-->Open）はStatusChangeLogにコメント必須

### 権限ルール（ドメイン内に配置）

| 操作 | 許可ロール | 条件 |
|------|-----------|------|
| Project登録・編集 | Admin | - |
| Issue登録（ReportedBy） | Admin, Supervisor | - |
| Assignee割り振り | Admin, Supervisor | - |
| PointOut --> Open | Admin, Supervisor | Assignee設定 |
| Open --> InProgress | Worker, Admin, Supervisor | Workerは自身がAssigneeの場合のみ |
| InProgress --> Done | Worker, Admin, Supervisor | Workerは自身がAssigneeの場合のみ |
| Done --> Confirmed | Admin, Supervisor | - |
| Done --> Open（否認） | Admin, Supervisor | コメント必須、写真任意 |
| InProgress --> Open（差戻） | Admin, Supervisor | - |
| Confirmed --> Open（再指摘） | Admin, Supervisor | コメント必須 |
| 写真追加 | Admin, Supervisor, Worker | - |
| 支部CRUD | Admin | - |
| ユーザー管理 | Admin | - |

---

## 0.4 画面遷移・UI仕様

### ロール別ログイン後フロー

**Admin（本部管理者）:**
```
ログイン
  ▼
[画面A] 支部一覧（Admin起点画面）
  │  支部名 / プロジェクト数 を一覧表示
  │  支部の追加（Branch typeのみ）・編集・削除
  │  支部を選択
  ▼
[画面B] 支部管理（タブ切り替え）
  ├─ [タブ1] プロジェクト一覧（デフォルト表示）
  │    │  プロジェクト名 / 計画 / 納期 / 進捗率 / 指摘件数
  │    │  プロジェクト情報の登録・編集が可能
  │    │  プロジェクトを選択
  │    ▼
  │  [画面D] 3Dビュー
  │    │  左: 3Dビュー（マーカー表示 + ピン登録操作）
  │    │  右: 指摘一覧パネル（フロア・ステータスフィルタ付き）
  │    │  マーカー or 指摘名をクリック
  │    ▼
  │  [画面E] 指摘詳細
  │       指摘内容 + 写真 + ステータス変更 + Assignee設定 + 履歴
  │
  └─ [タブ2] ユーザー管理
       対象支部内のユーザー一覧 / 追加 / 編集 / 無効化
```

**Supervisor（現場監督）:**
```
ログイン
  ▼
[画面B-1] プロジェクト一覧（自分の所属支部に自動スコープ）
  │  プロジェクト名 / 計画 / 納期 / 進捗率 / 指摘件数
  │  ※ プロジェクト情報は閲覧のみ（編集不可）
  │  ※ タブなし（ユーザー管理不要）
  │  プロジェクトを選択
  ▼
[画面D] 3Dビュー → [画面E] 指摘詳細
（以降はAdminと同じ）
```

**Worker（作業担当者）:**
```
ログイン
  ▼
[画面B-2] プロジェクト一覧（自分がAssigneeの指摘があるPJのみ表示）
  │  プロジェクト名 / 計画 / 納期 / 進捗率※ / 指摘件数※
  │  ※ 進捗率・指摘件数は自分担当分のみで算出
  │  ※ プロジェクト情報は閲覧のみ
  │  プロジェクトを選択
  ▼
[画面D-1] 3Dビュー（自分担当のマーカーのみ表示）
  ▼
[画面E] 指摘詳細
  （自分担当のステータス変更のみ可能）
```

### 画面別詳細仕様

#### 画面A: 支部一覧（Admin起点画面）
- Admin権限でのログイン後に表示される起点画面
- 全支部（Branch）の一覧を表示

| 表示項目 | 説明 |
|---------|------|
| 支部名 | Organization.Name |
| プロジェクト数 | 当該支部に紐づくProjectの件数 |

- 支部の追加（Branch typeのみ。Headquarters typeは作成不可）・編集・削除が可能
- 支部名をクリック → 画面Bへ遷移

#### 画面B: 支部管理（タブ切り替え）

**タブ1: プロジェクト一覧（デフォルト表示）**

| 表示項目 | 説明 |
|---------|------|
| プロジェクト名 | Project.Name |
| 計画 | Project.Plan（テキスト。長文の場合は先頭N文字 + 「...」で省略表示） |
| 納期 | Project.DueDate |
| 進捗率 | 指摘ステータスから算出（Done=50%, Confirmed=100%, 他=0% の平均。0件時は0%） |
| 指摘件数 | プロジェクトに紐づく全指摘の件数 |

- Adminのみ: プロジェクト情報（名前・計画・開始日・納期・ステータス・対象建造物）の新規登録・編集が可能
- Supervisor: 同じレイアウトだが閲覧のみ（自分の所属支部に自動スコープ）
- Worker: 自分がAssigneeの指摘があるPJのみ表示。進捗率・指摘件数は自分担当分のみで算出
- プロジェクトを選択 → 直接 画面D（3Dビュー）へ遷移

**タブ2: ユーザー管理（Admin専用）**
- 対象支部内のユーザー一覧を表示
- ユーザーの追加・編集・無効化
- ※ Supervisor / Worker にはこのタブは表示しない

#### 画面D: 3Dビュー

**右パネル: 指摘一覧パネル**

| 表示項目 | 説明 |
|---------|------|
| フロア | Issue.FloorId → Floor.Name |
| 指摘名 | Issue.Title |
| ステータス | Issue.Status（バッジ表示、色分け） |
| 是正期限 | Issue.DueDate |

**双方向ハイライト連動:**
- 指摘一覧パネルの項目をマウスオーバー → 3Dビュー上の対応するマーカーがハイライト
- 3Dビュー上のマーカーをマウスオーバー → 指摘一覧パネルの対応する指摘名がハイライト

**フィルタ:**
- 初期表示は全フロア・全ステータス表示（フィルタなし）
- フロアフィルタ: 3Dビュー内のプルダウンでフロアを選択可能
- ステータスフィルタ: ステータスによる絞り込み機能
- フロア変更時は3Dビュー（セクションボックス等）と右パネルの指摘一覧が連動して更新

**詳細への遷移:**
- マーカーをクリック → 指摘詳細（画面E）へ遷移
- 指摘一覧パネルの指摘名をクリック → 指摘詳細（画面E）へ遷移

**新規指摘の登録（Admin/Supervisorのみ）:**
- PC: 3Dモデル上の部材をダブルクリック → 指摘登録フォームへ遷移
- スマホ/タブレット: 部材を長押し → 指摘登録フォームへ遷移
- ダブルクリック/長押しの採用理由: シングルクリックはビューの回転・選択操作と競合するため
- 登録時にAssignee（作業担当者）を同時設定可能（設定した場合PointOutをスキップ）

**マーカーのステータス表示:**
- マーカーの色でステータスを視覚的に区別（PointOut:灰, Open:青, InProgress:黄, Done:緑, Confirmed:紫）

**Worker向け:**
- 自分がAssigneeの指摘のマーカーのみ表示
- 新規指摘登録操作は無効化

**空間指摘について:**
- 今回は部材指摘（dbId）のみ実装する
- 空間指摘（worldPosition）はNice to haveであることを担当者に確認済み
- ドメインモデル上はLocation Value Objectで両対応の構造を維持

#### 画面E: 指摘詳細
- 指摘内容（タイトル・説明・種別・フロア・位置情報）の表示
- 写真表示（Before/After/Rejection の区分表示）
- ステータス変更操作（権限に応じたボタン表示）
- Assignee設定（Admin/Supervisorのみ）
- ステータス変更履歴タブ（StatusChangeLog一覧）
- 「3Dビューで位置を確認」ボタン: 該当指摘の位置にカメラフォーカスした状態で3Dビューを表示

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
| Command | Issue作成、ステータス変更、写真追加、Assignee設定、Project登録・編集、組織CRUD、ユーザーCRUD | Domain集約を経由。整合性を担保 |
| Query | プロジェクト一覧取得（進捗率含む）、指摘一覧取得（ロール別フィルタ）、指摘詳細取得、ステータス変更履歴取得、組織一覧、ユーザー一覧 | DBから直接読み取り。集約を経由しない |

件数増加時の方針: Query側は将来的にRead Model（Materialized View/検索用テーブル）を分離可能な構造にしておく。特に進捗率算出はN+1問題を招きやすいため、プロジェクト一覧Queryではサブクエリまたは集計関数で一括算出する。

---

## 0.7 永続化戦略

### DB設計方針
- Issue集約をそのまま1テーブル + Photos子テーブル + StatusChangeLogs子テーブルに写像
- Location情報はIssueテーブル内にlocationType + dbId + worldPositionX/Y/Zカラム
- Organization（組織）はself-referencing FK（parent_id）で本部→支部の階層を表現
- StatusChangeLogテーブルでIssueの全状態変更履歴を保持（否認コメント含む）
- 進捗率はDBに永続化せず、Query時にSQLで算出（AVG + CASE式）

### 進捗率のQuery実装方針
```sql
-- プロジェクト一覧で進捗率を一括算出する例
SELECT
  p.project_id,
  p.name,
  p.plan,
  p.due_date,
  COUNT(i.issue_id) AS issue_count,
  COALESCE(
    AVG(
      CASE i.status
        WHEN 'Done' THEN 50
        WHEN 'Confirmed' THEN 100
        ELSE 0
      END
    ),
    0
  ) AS progress_rate
FROM projects p
LEFT JOIN issues i ON p.project_id = i.project_id
GROUP BY p.project_id;
```
※ Worker向けにはWHERE i.assignee_id = :currentUserIdを追加してフィルタリング

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
|   |   |   +-- element-floor-mapping.ts
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
| GET | /api/organizations/{orgId}/users | 支部内ユーザー一覧取得 | Query | Admin |
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

### Model Initialization（モデル初期化）— 判断17で改訂
| Method | Path | 責務 | 種別 | 権限 |
|--------|------|------|------|------|
| GET/POST | /api/buildings/{buildingId}/sync-levels | APS Model Derivative APIからレベル名を取得しFloorテーブルを同期 | Command | 認証済み |
| PATCH | /api/buildings/{buildingId}/floors | フロアのelevationを一括更新（Viewer BoundingBoxから推定した値を反映） | Command | 認証済み |
| GET | /api/buildings/{buildingId}/element-floor-mapping/{dbId} | 部材のフロア判定結果取得 | Query | 認証済み |
| POST | /api/buildings/{buildingId}/element-floor-mapping | 部材フロアマッピングを一括登録（Viewer起動時にFEから送信） | Command | 認証済み |

※ 当初は`POST /initialize-model`でFEからレベル＋部材データを一括送信する設計だったが、
  実際のBIMモデル（MEP）ではAEC LevelsExtensionが利用できなかったためアプローチを変更した（判断17参照）。
※ フロアデータの作成フロー:
  ① Viewer画面初回表示時、フロアが空なら`GET /sync-levels`を呼び出し
  ② サーバーがAPS Model Derivative APIから「参照レベル」プロパティのユニーク値を抽出しFloorレコードを作成（elevation=null）
  ③ Viewer起動後、全部材のBoundingBox Zからフロアごとの標高を推定し`PATCH /floors`で更新
  ④ 部材フロアマッピングを構築し`POST /element-floor-mapping`で非同期永続化
※ Floorはシードデータではなく、モデル初期化APIでレベルデータから自動生成する。

### Project
| Method | Path | 責務 | 種別 | 権限 |
|--------|------|------|------|------|
| GET | /api/organizations/{orgId}/projects | 支部のプロジェクト一覧取得（進捗率・指摘件数含む） | Query | 認証済み※ |
| GET | /api/projects/{id} | プロジェクト詳細取得 | Query | 認証済み |
| POST | /api/organizations/{orgId}/projects | プロジェクト作成 | Command | Admin |
| PATCH | /api/projects/{id} | プロジェクト更新（名前・計画・納期等） | Command | Admin |

※ Workerの場合、自分がAssigneeの指摘があるPJのみ返却。進捗率・指摘件数も自分担当分のみで算出。

### Viewer
| Method | Path | 責務 | 種別 | 権限 |
|--------|------|------|------|------|
| GET | /api/viewer/token | APSアクセストークン取得 | Query | 認証済み |

### Issue
| Method | Path | 責務 | 種別 | 権限 |
|--------|------|------|------|------|
| POST | /api/projects/{id}/issues | 指摘作成（Assignee同時設定可） | Command | Admin, Supervisor |
| GET | /api/projects/{id}/issues | 指摘一覧取得（?floorId=&status=） | Query | 認証済み※ |
| GET | /api/projects/{id}/issues/{issueId} | 指摘詳細取得（StatusChangeLog含む） | Query | 認証済み |
| PATCH | /api/projects/{id}/issues/{issueId}/status | ステータス変更 | Command | Admin, Supervisor, Worker※ |
| PATCH | /api/projects/{id}/issues/{issueId}/assignee | 作業担当者割り振り | Command | Admin, Supervisor |
| POST | /api/projects/{id}/issues/{issueId}/photos | 写真アップロード | Command | Admin, Supervisor, Worker |
| GET | /api/photos/{photoId}/url | 写真URL取得（署名付き） | Query | 認証済み |

※ Workerの場合、指摘一覧は自分がAssigneeの指摘のみ返却
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
| **Phase 7** | 指摘入力/一覧/位置遷移UI + ロール別UI制御 + 履歴表示（右パネル内一覧↔詳細切替） | 3h |
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
| 大量データ | Query側にRead Model分離。ページネーション + フィルタインデックス。進捗率はMaterialized Viewで事前計算も検討 |
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
- **決定**: Admin向け管理画面でProject CRUD操作を提供。Building/Floorは最低要件ではシードデータで代替。
- **理由**: 画面遷移の見直しにより、Adminがプロジェクトの登録・編集を行う導線が明確化されたため、ProjectのCRUDは必須機能として組み込む。

### 判断9: BIMモデルURN（ModelUrn）の配置場所
- **決定**: Building（建造物）エンティティに配置。
- **理由**: 1つの建造物に対して1つの統合モデルが存在する構造。フロア選択はViewer側のフィルタリングで対応。

### 判断10: 空間指摘（worldPosition）を今回実装しない
- **決定**: 部材指摘（dbId）のみ実装。空間指摘は実装しない。
- **理由**: Nice to have確認済み。ドメインモデル上はLocation VOで両対応の構造を維持。

### 判断11: 認可の実装場所
- **決定**: Application層で認可チェック（ロール検証）、Domain層で権限ルール定義。
- **理由**:
  - Domain層に認可ロジックを置くと、セッションやリクエストコンテキストへのアクセス（外部依存）が必要になり、Domain層の純粋性が損なわれる
  - Presentation層（API Route Handler）に認可ロジックを置くと、複数エンドポイント間での重複・漏れが生じやすい
  - Application層はユースケースのオーケストレーションを担当するため、「誰が何をできるか」のチェックを行う最適な場所である
- **実装パターン**:
  ```typescript
  // Application層のCommandハンドラ内
  class UpdateIssueStatusCommand {
    async execute(input: Input, currentUser: CurrentUser): Promise<void> {
      requireRole(currentUser, [Role.SUPERVISOR, Role.WORKER]); // 認可チェック
      const issue = await this.repository.findById(input.issueId);
      issue.changeStatus(input.newStatus, currentUser.id); // Domain層は純粋なビジネスルールのみ
      await this.repository.save(issue);
    }
  }
  ```
- **Domain層の責務**: ステータス遷移ルール（例: `PointOut → Open` のみ許可）などの純粋なビジネスルールのみを担当する。「誰が遷移を実行できるか」というロールチェックはApplication層の責務とする。
- **既存判断との整合性**: 判断4（状態遷移ルールはDomain層）と矛盾しない。ルールの「何が許可されるか」はDomain層、「誰が実行できるか」はApplication層と責務を明確に分離する。

### 判断12: Organization構造を1階層（本部→支部）に限定
- **決定**: 再帰的な多階層ではなく、本部と支部の1階層構造。
- **理由**: 建設業界では「本社/支社→現場」の2階層が一般的。将来的にはClosure Tableパターンで対応可能。

### 判断13: PointOutスキップの許可
- **決定**: 指摘作成時にAssigneeを同時設定した場合、PointOutをスキップしOpen状態で作成可能。
- **理由**: Supervisorが担当者を既に把握している場合、PointOut-->Openの2ステップは冗長。両方のワークフローに対応することで現場の柔軟性を担保。

### 判断14: フロア一覧画面・指摘一覧画面の廃止と3Dビューへの直接遷移
- **決定**: 独立した「フロア一覧」画面および「指摘一覧」画面を廃止する。画面遷移を「プロジェクト選択 → 3Dビュー → 指摘詳細」に再設計する（判断24でさらに改訂）。
- **理由**: フロアは指摘の属性の一つであり、独立画面を設ける必然性が薄い。指摘一覧は3Dビューの右パネル内に統合することで、ユーザーが常に3D空間上で指摘の文脈を把握しながら操作できる。中間画面を排除してクリック数を削減するとともに、「指摘には必ず3D上の位置を紐づける」というドメイン要件を導線レベルで強制できる。3Dビュー側でフロアフィルタ（プルダウン）と連動したセクションボックス制御を提供する。

### 判断15: プロジェクトへのアクセスモデル（ProjectMemberを設けない）
- **決定**: ProjectMemberテーブルは導入しない。プロジェクトへのアクセス権はロールにより異なる粒度で制御する。
- **Supervisorのアクセス**: 将来的にProjectMemberテーブルを導入し、プロジェクト単位でSupervisorの参加を管理する。現時点では同一Branch所属のSupervisorは当該Branchの全Projectにアクセス可能。
- **Workerのアクセス**: ProjectMemberは不要。SupervisorがIssueにAssigneeとして割り振った時点で、当該Issueおよび所属Projectへのアクセスが発生する。Issue.AssigneeIdが実質的なアクセスキーとなる。
- **理由**: ProjectとUserはOrganization（Branch）を通じて間接的に関連付けられる。Workerレベルではプロジェクト全体へのアクセスではなく、割り振られた指摘のみにアクセスできれば十分であり、これはIssue.AssigneeIdで実現可能。SupervisorのProjectMemberは実運用で必要になるタイミングで追加する。

### 判断16: BIMモデルのlevelプロパティを信頼せず、Z座標ベースでフロア判定する
- **決定**: 部材が持つlevelプロパティではなく、標高 + BoundingBox底面Z座標でフロアを判定する。判定結果はElementFloorMappingテーブルに登録する。
- **理由**: 実際のBIMデータを検証した結果、明らかにB1Fの位置にある配管にlevel:4（4F）がセットされているケースを確認した。levelプロパティはモデル作成者の設定に依存し、信頼できない。この不整合は、4Fの指摘一覧にB1Fの配管が表示される等の深刻なUX問題を引き起こす。
- **判定ロジック**: `Floor = { f | Elevation_f <= BoundingBox.min.z < Elevation_{f+1} }`。最上階以上はRFに、最下階未満はB1Fに帰属。
- **Floorデータの自動生成**: FloorテーブルのデータはAPS Model Derivative APIのメタデータから自動生成する（判断17で改訂）。手動定義との不整合を原理的に排除する。
- **空間指摘のフロア判定**: ElementFloorMappingはdbIdベース。空間指摘（worldPosition）の場合はFloor.Elevationを参照し、クリック時のZ座標からリアルタイム判定する。
- **課題資料との関係**: この問題は課題PDFに記載がない。実際にAPS Viewerでモデルを検証して初めて発見される、BIMデータ品質に起因する設計課題である。
- **実装時の改訂**: 当初はAEC LevelsExtensionを前提としていたが、実際のモデルでは利用できなかったため判断17でアプローチを変更した。

### 判断17: フロア・部材マッピングのデータ取得戦略をAEC LevelsExtensionからModel Derivative API + BoundingBox Zに変更
- **決定**: 当初のAEC LevelsExtension依存から、以下の2段階アプローチに変更する。
  - **Stage 1（サーバーサイド）**: APS Model Derivative APIの全プロパティから「参照レベル」のユニーク値を抽出し、フロアレコードを作成する（elevation=null）
  - **Stage 2（クライアントサイド）**: Viewer起動時に全リーフノードのBoundingBox Zから各フロアの標高を推定し、部材フロアマッピングを構築する
- **理由**: 実装段階で以下の制約が判明した。
  1. **対象モデルがMEP（設備）モデル**: 建築モデルとは異なり、オブジェクトツリーに「Levels」カテゴリが存在しない。AEC LevelsExtensionのデータも取得できない
  2. **AEC Model Dataエンドポイントが404**: このモデルではAEC Model Dataが生成されておらず、標高情報をAPI経由で取得する手段がない
  3. **プロパティ値はオフセット**: `上面の高さ`/`下面の高さ`は参照レベルからの相対値であり、絶対標高ではない
- **代替手段の選定**:
  - Model Derivative APIの`/metadata/{guid}/properties`エンドポイントから全部材のプロパティを取得し、`拘束 > 参照レベル`（`reference level`/`base constraint`）プロパティからユニークなレベル名を収集する
  - フロア名からfloorNumberを決定するロジック: PIT→-1, 1F→1, ..., 7F→7, RFL→8
  - 基準レベル（設計GL等）はフロアではないため除外する
- **標高推定ロジック**: 全部材のBoundingBox底面Z座標の分布をフロア数で均等分割し、各区間をフロアの標高範囲とする。参照レベルプロパティはモデル作成者の設定に依存するため使用しない（判断16の方針と一貫）。
- **部材フロアマッピング**: 全部材をBoundingBox底面Zのみで判定する。`Floor = { f | Elevation_f <= BoundingBox.min.z < Elevation_{f+1} }`。最上階以上は最上階に、最下階未満は最下階に帰属。
- **キャッシュ戦略**: 初回Viewer起動時にマッピングを構築し、バックエンドに非同期永続化する。2回目以降はバックエンドからキャッシュを読み込むことで起動を高速化する。
- **設計上の教訓**: BIMモデルの構造（建築/設備/構造）によって利用可能なAPIやメタデータが大きく異なる。設計段階で想定したデータソースが実際のモデルで利用できない場合に備え、フォールバック戦略を持つことが重要。

### 判断18: 認証にNextAuth Credentials Providerを採用する
- **決定**: 認証ライブラリとしてNextAuth.js を採用し、Credentials Provider（メールアドレス + パスワード認証）で実装する。
- **理由**:
  - 課題の制約の中でOAuth連携（Google / Azure AD等）のセットアップは過剰なコストであり、本課題の評価観点（設計品質）とも一致しない
  - NextAuth.jsはNext.js App Routerとの統合が公式サポートされており、セッション管理・CSRF対策・Cookie管理を自前実装するリスクを排除できる
  - Credentials Providerはシンプルなメール＋パスワード認証を提供しつつ、将来的なOAuth Provider（Google, Microsoft等）への差し替えが`providers`配列の変更のみで可能な構造を維持する
- **実装方針**:
  - `bcrypt`でパスワードをハッシュ化してDBに保存
  - NextAuthの`session.user`に`userId`と`role`を含める（JWT戦略）
  - API Route Handlerでは`getServerSession()`でセッションを取得し、Application層に`CurrentUser`として渡す
- **将来のOAuth移行**: `providers`配列にOAuth Providerを追加するだけで既存のCredentials Providerと並立できる。認証プロバイダーの変更がApplication層以下に影響を与えない設計を維持する。
- **本番設計との関係**: 0.12の「Azure AD B2C or Auth0」への移行を想定した場合も、NextAuthの`providers`差し替えで対応可能。Application層の`CurrentUser`型とその取得インターフェースが変わらない限り、Domain層・Infrastructure層への影響はない。

### 判断19: 進捗率を導出値（Derived Value）とする
- **決定**: 進捗率はProjectテーブルに永続化せず、Query時にSQL集計で算出する。
- **理由**: 指摘のステータス変更のたびにProjectの進捗率を更新する方式は、整合性管理が複雑になる。Query時算出であれば常に最新値が取得でき、実装もシンプル。件数が増大した場合はMaterialized Viewでの事前計算に移行可能な設計を維持する。
- **算出ルール**: Done=50%, Confirmed=100%, それ以外=0%の平均。指摘0件時は0%。

### 判断20: Adminの指摘登録権限の付与
- **決定**: Adminにも全支部・全プロジェクトに対する指摘登録権限を付与する（スーパー権限）。
- **理由**: Adminは全体管理者として各支部のプロジェクトを横断的に管理する。品質監査や緊急対応の観点から、Admin自身が指摘を登録できることは実運用上合理的。ReportedByにAdminのUserIdが入ることで「誰が登録したか」も追跡可能。

### 判断21: Workerの表示スコープを「自分担当の指摘があるPJのみ」に限定
- **決定**: Workerがプロジェクト一覧で閲覧できるのは、自分がAssigneeとして割り振られた指摘が1件以上存在するプロジェクトのみ。進捗率・指摘件数も自分担当分のみで算出する。
- **理由**: Workerは自分の是正作業に集中すべきであり、関係のないプロジェクトや指摘が表示されることはノイズとなる。自分の担当範囲に絞ることで、優先順位の判断が容易になり、現場での操作効率も向上する。

### 判断22: Project CRUD（計画フィールド含む）のAdmin限定
- **決定**: プロジェクト情報（名前・計画・開始日・納期・ステータス・対象建造物）の登録・編集はAdmin権限のみに限定する。Planフィールド（text型）を新設し、工事計画の自由記述を管理する。
- **理由**: プロジェクトの計画や納期は経営判断に直結する情報であり、本部管理者が統括すべき。Supervisorは現場の指摘管理に集中し、プロジェクト情報は閲覧のみとすることで権限分離を明確にする。

### 判断23: ロール別の画面遷移・起点画面の分離
- **決定**: ロールに応じてログイン後の起点画面と表示スコープを分離する。Admin: 支部一覧（画面A）→ 支部管理タブ（画面B）→ 3Dビュー。Supervisor: 自分の所属支部のプロジェクト一覧に直接遷移（画面Bタブ1相当）→ 3Dビュー。Worker: 自分が担当の指摘があるPJのみ表示（画面B-2）→ 3Dビュー。
- **理由**: 各ロールの業務実態に合わせた導線を提供することで、不要な情報ノイズを排除し操作効率を向上させる。Adminは横断的管理、Supervisorは支部内の現場管理、Workerは自分の作業にフォーカスするという責務の違いをUIレベルでも反映する。
- **ユーザー管理の配置**: 独立した画面（旧画面F）ではなく、支部管理（画面B）のタブ2として統合する。支部という文脈の中で、プロジェクト管理とユーザー管理を同一画面のタブで切り替えられる構成により、Adminの操作フローが簡潔になる。
- **本部制約のシーダ対応**: Headquarters typeの組織はシーダで1件のみ登録する。アプリからは Branch typeのみ作成可能とし、Type=Headquarters を指定した作成リクエストはバリデーションエラーとする。

### 判断24: 指摘一覧画面（画面C）の廃止と3Dビューへの直接遷移
- **決定**: プロジェクト選択後に独立した指摘一覧画面（旧画面C）を経由せず、直接3Dビュー（画面D）へ遷移する。指摘の一覧は3Dビュー右パネル内でのみ表示する。
- **理由**: 3Dビューの右パネルがすでに指摘一覧パネル（フロアフィルタ付き）を提供しており、独立した指摘一覧画面と機能が重複する。中間画面を省くことでクリック数を削減し、ユーザーが即座に3D空間上で指摘の文脈を把握できる。指摘管理ツールの主役はあくまで3Dビューであり、その前に別画面を挟む必然性がない。
- **フロアフィルタの扱い**: 旧設計では指摘一覧画面でフィルタを設定してから3Dビューへ引き継ぐ構成だったが、新設計では3Dビュー内のフロアプルダウンで直接操作する。初期表示は全フロア表示とする。
- **新規指摘登録の入口**: 旧画面Cにあった「新規追加」ボタンは廃止。指摘登録は3Dビュー上の部材ダブルクリック（PC）/ 長押し（スマホ）のみとする。これにより「3D上の位置を必ず紐づける」というドメインの根本要件が画面設計レベルで強制される。
