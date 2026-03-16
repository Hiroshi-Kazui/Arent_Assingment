# Claude Code プロンプト集（Phase 1〜8）

同一セッションで以下を順番に投入する。各Phase完了ごとに `git add -A && git commit -m "Phase N: ..."` を実行すること。

---

## Phase 1: Docker環境構築

```
## コンテキスト

施工現場向け「指摘管理ツール」のPhase 1（Docker環境構築）を実施する。
設計資料は以下にある：

- docs/phase0_plan.md（全体設計・要件・技術選定）
- docs/architecture.mmd（アーキテクチャ図）
- docs/er-diagram.mmd（ER図）

まずこれらを読み込んでから作業を開始すること。

## Phase 1 のゴール

1. `docker-compose.yml` を作成し、以下を起動できる状態にする：
   - PostgreSQL 16（ポート5432）
   - MinIO（APIポート9000、コンソールポート9001）

2. `.env.example` を作成（DB接続文字列、MinIOクレデンシャル等）

3. MinIOの初期バケット（`photos`）が自動作成されるよう設定

4. `docker compose up -d` で正常起動することを確認

## 制約

- 既存の docs/ 配下のファイルは変更しない
- docker-compose.yml はプロジェクトルートに配置
- PostgreSQLのDB名は `issue_management`
- MinIOのルートユーザー/パスワードは .env.example にプレースホルダとして記載
- ボリュームを使ってデータを永続化する

## 確認手順

作成後、以下を実行して動作を確認すること：
- `docker compose up -d`
- PostgreSQLへの接続確認（psqlまたはprisma等で）
- MinIOコンソール（localhost:9001）へのアクセス確認
- photosバケットの存在確認
```

---

## Phase 2: Domain層実装

```
## Phase 2: Domain層実装

Phase 1（Docker環境構築）が完了した。
次にDomain層を実装する。設計は docs/phase0_plan.md の §0.3（ドメインモデル）に従うこと。

## ゴール

src/domain/ 配下に以下を実装：

### 1. Value Objects（src/domain/models/）
- `location.ts` — LocationType（DbId / WorldPosition）を持つ。部材指摘時はdbId必須、空間指摘時はworldPosition(x,y,z)必須。ファクトリメソッドで生成時バリデーション。
- `coordinate.ts` — 緯度・経度（Buildingの位置用）。範囲バリデーション付き。

### 2. エンティティ / 集約（src/domain/models/）
- `building.ts` — Building エンティティ（BuildingId, Name, Address, Coordinate, ModelUrn）
- `floor.ts` — Floor エンティティ（FloorId, BuildingId, Name, FloorNumber）
- `project.ts` — Project 集約（ProjectId, BuildingId, Name, StartDate, DueDate, Status）
- `issue.ts` — Issue 集約ルート。**状態遷移ロジックをこのクラス内に実装**：
  - Open → InProgress（着手）
  - InProgress → Done（是正完了）
  - InProgress → Open（差し戻し）
  - Done → InProgress（再指摘）
  - Open → Done は禁止（ビジネスルール）
  - 不正な遷移時はDomainErrorをthrow
- `photo.ts` — Photo エンティティ（PhotoId, IssueId, BlobKey, PhotoPhase: Before/After）

### 3. Repository Interfaces（src/domain/repositories/）
- `issue-repository.ts` — IIssueRepository（save, findById, findByProjectId, findByProjectIdAndFloorId）
- `project-repository.ts` — IProjectRepository（findById, findAll）
- `building-repository.ts` — IBuildingRepository（findById, findAll）
- `floor-repository.ts` — IFloorRepository（findByBuildingId）
- `photo-storage.ts` — PhotoStorage interface（upload, getSignedUrl）
- `viewer-token-provider.ts` — ViewerTokenProvider interface（getAccessToken）

### 4. Domain Errors（src/domain/errors/）
- `domain-error.ts` — 基底エラークラス
- `invalid-status-transition-error.ts` — 不正な状態遷移

## 設計原則

- Domain層は外部ライブラリに一切依存しない（Prisma, Next.js等をimportしない）
- IDはブランド型またはクラスで型安全にする（string直接は避ける）
- イミュータブル設計を意識（状態変更はメソッド経由で新しい状態を返す or 内部で管理）
- エンティティの生成はファクトリメソッド（create / reconstruct）パターンを推奨

## 確認

実装後、Issue集約の状態遷移ロジックに対するユニットテストを1ファイル作成して、正常遷移と不正遷移（Open→Done）の両方が期待通り動くことを確認すること。
テストランナーはvitestを使用。
```

---

## Phase 3: Infrastructure層実装

```
## Phase 3: Infrastructure層実装

Phase 2（Domain層）が完了した。
次にInfrastructure層を実装する。設計は docs/phase0_plan.md の §0.7, §0.8, §0.9 に従う。

## ゴール

### 1. Prisma Schema（prisma/schema.prisma）
docs/er-diagram.mmd に基づき以下テーブルを定義：
- Building（building_id: UUID PK, name, address, latitude, longitude, model_urn, created_at, updated_at）
- Floor（floor_id: UUID PK, building_id: FK, name, floor_number, created_at, updated_at）
- Project（project_id: UUID PK, building_id: FK, name, start_date, due_date, status, created_at, updated_at）
- Issue（issue_id: UUID PK, project_id: FK, floor_id: FK, title, description, issue_type, status, location_type, db_id?:Int, world_position_x?:Decimal, world_position_y?:Decimal, world_position_z?:Decimal, reported_by, created_at, updated_at）
- Photo（photo_id: UUID PK, issue_id: FK, blob_key, photo_phase, uploaded_at）

注意：
- UUIDはデフォルト値 uuid() を使用
- created_at/updated_at は @default(now()) / @updatedAt
- リレーションを正しく定義（onDelete設定含む）
- datasource は postgresql、.env の DATABASE_URL を参照

### 2. Prisma Repository実装（src/infrastructure/prisma/）
Domain層の各Repository Interfaceを実装する：
- `prisma-issue-repository.ts` — IIssueRepository を実装。Domain Issue集約 ↔ Prismaモデルのマッピングを含む。
- `prisma-project-repository.ts` — IProjectRepository を実装
- `prisma-building-repository.ts` — IBuildingRepository を実装
- `prisma-floor-repository.ts` — IFloorRepository を実装
- `prisma-client.ts` — PrismaClientのシングルトン（Next.jsのホットリロード対策含む）

重要：Repository実装はDomainモデルとPrismaモデルの変換層として機能する。Prismaの型がDomain層に漏れないようにする。

### 3. MinIO PhotoStorage実装（src/infrastructure/minio/）
- `minio-photo-storage.ts` — Domain層の PhotoStorage interface を実装
  - upload: Bufferを受け取り、MinIOのphotosバケットにputObject
  - getSignedUrl: presignedGetObjectで署名付きURLを生成（有効期限: 1時間）
- `minio-client.ts` — MinIOクライアントのシングルトン

Blobキー命名規則: `projects/{projectId}/issues/{issueId}/photos/{photoId}.{ext}`

### 4. APS TokenProvider実装（src/infrastructure/aps/）
- `aps-token-provider.ts` — ViewerTokenProvider interface を実装
  - 2-legged OAuth で https://developer.api.autodesk.com/authentication/v2/token にPOST
  - grant_type=client_credentials, scope=data:read
  - APS_CLIENT_ID, APS_CLIENT_SECRET は環境変数から取得
  - トークンキャッシュ（有効期限内は再利用）を実装

### 5. シードデータ（prisma/seed.ts）
以下の初期データを投入するシードスクリプトを作成：
- Building: 1件（「Aビル」、model_urnは環境変数 APS_MODEL_URN から取得）
- Floor: 5件（1F〜5F、floor_number: 1〜5）
- Project: 1件（「Aビル新築工事」、status: Active）

package.json に prisma の seed 設定を追加：
"prisma": { "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts" }

### 6. .env.example 更新
以下を追加（Phase 1で作成済みの項目はそのまま維持）：
- APS_CLIENT_ID=your_client_id
- APS_CLIENT_SECRET=your_client_secret
- APS_MODEL_URN=your_model_urn

## 確認

1. `npx prisma generate` が成功すること
2. `npx prisma db push` でDBにテーブルが作成されること（docker compose upしたPostgreSQLに対して）
3. `npx prisma db seed` でシードデータが投入されること
4. シード後、prisma studioまたはpsqlでデータが確認できること
```

---

## Phase 4: Application層実装

```
## Phase 4: Application層（Command/Queryハンドラ）実装

Phase 3（Infrastructure層）が完了した。
次にApplication層を実装する。設計は docs/phase0_plan.md の §0.6（CQRS的整理）に従う。

## 設計方針

- Command: Domain集約を経由して整合性を担保する書き込み操作
- Query: DBから直接読み取り。集約を経由しない（パフォーマンス優先）
- Application層はオーケストレーションのみ。ビジネスルールはDomain層に委譲。

## ゴール

### 1. DTOs（src/application/dto/）
各ユースケースの入出力型を定義：
- `issue-dto.ts`:
  - CreateIssueInput: { projectId, floorId, title, description, issueType, locationType, dbId?, worldPositionX/Y/Z?, reportedBy }
  - UpdateIssueStatusInput: { issueId, projectId, newStatus }
  - IssueListItemDto: { issueId, title, issueType, status, locationType, dbId?, worldPositionX/Y/Z?, reportedBy, createdAt }
  - IssueDetailDto: IssueListItemDto + { description, floorId, photos: PhotoDto[] }
  - PhotoDto: { photoId, blobKey, photoPhase, uploadedAt }
- `project-dto.ts`:
  - ProjectListItemDto: { projectId, name, buildingId, status, issueCount }
- `building-dto.ts`:
  - BuildingDto: { buildingId, name, address, modelUrn }
- `floor-dto.ts`:
  - FloorListItemDto: { floorId, name, floorNumber, issueCount }

### 2. Commands（src/application/commands/）
- `create-issue.ts`:
  - CreateIssueInput を受け取り、Issue集約を生成、IIssueRepository.save()
  - 戻り値: 生成されたissueId
- `update-issue-status.ts`:
  - IssueをfindById → Domain集約の状態遷移メソッド呼び出し → save
  - 不正遷移時はDomainErrorがthrowされるのでそのまま上位に伝播
- `add-photo.ts`:
  - 入力: { issueId, projectId, file: Buffer, fileName, contentType, photoPhase }
  - フロー: ① PhotoId生成 → ② BlobKey生成 → ③ PhotoStorage.upload → ④ Issue集約にPhoto追加 → ⑤ save
  - Blobキー: `projects/{projectId}/issues/{issueId}/photos/{photoId}.{ext}`

### 3. Queries（src/application/queries/）
QueryはPrismaClientを直接使用する（Repositoryを経由しない）。CQRS的分離のため。
- `list-projects.ts`: Project一覧 + 各プロジェクトの指摘件数（_count）
- `list-buildings.ts`: Building一覧
- `list-floors.ts`: 指定BuildingIdのFloor一覧 + 各フロアの指摘件数
- `list-issues.ts`: 指定ProjectIdの指摘一覧。floorIdによるフィルタ対応。集約は経由せずDBから直接DTO変換。
- `get-issue-detail.ts`: 指定issueIdの詳細。Photosも含む。
- `get-photo-url.ts`: PhotoIdからBlobKeyを取得し、PhotoStorage.getSignedUrl()で署名付きURL生成

### 4. DI（依存注入）ヘルパー（src/application/di.ts または src/infrastructure/di.ts）
簡易的なDIコンテナまたはファクトリ関数を用意：
- 各Repository Interface → Prisma実装のバインド
- PhotoStorage → MinIO実装のバインド
- ViewerTokenProvider → APS実装のバインド
- Command/Queryハンドラの生成関数

フレームワーク不要。シンプルなファクトリ関数パターンで十分：
```typescript
export function createIssueCommandHandler() {
  const issueRepo = new PrismaIssueRepository();
  const photoStorage = new MinioPhotoStorage();
  return {
    createIssue: new CreateIssueHandler(issueRepo),
    updateStatus: new UpdateIssueStatusHandler(issueRepo),
    addPhoto: new AddPhotoHandler(issueRepo, photoStorage),
  };
}
```

## 確認

- CreateIssue → list-issues で作成したIssueが返ること（ユニットテストまたは手動確認）
- 状態遷移（Open→InProgress→Done）が正常に動作すること
- Open→Done の直接遷移がエラーになること
```

---

## Phase 5: API Routes実装

```
## Phase 5: API Routes実装

Phase 4（Application層）が完了した。
次にNext.js App RouterのRoute Handlersとして REST APIを実装する。
設計は docs/phase0_plan.md の §0.10（API設計）に従う。

## ゴール

以下のRoute Handlersを src/app/api/ 配下に実装する。

### Building / Floor
- GET /api/buildings → src/app/api/buildings/route.ts
  - ListBuildings queryを呼び出し、BuildingDto[]を返す
- GET /api/buildings/[buildingId]/floors → src/app/api/buildings/[buildingId]/floors/route.ts
  - ListFloors queryを呼び出し、FloorListItemDto[]（issueCount含む）を返す

### Project
- GET /api/projects → src/app/api/projects/route.ts
  - ListProjects queryを呼び出し、ProjectListItemDto[]を返す
- GET /api/projects/[id] → src/app/api/projects/[id]/route.ts
  - プロジェクト詳細（building情報含む）

### Viewer
- GET /api/viewer/token → src/app/api/viewer/token/route.ts
  - ViewerTokenProvider.getAccessToken() を呼び出し、{ access_token, expires_in } を返す

### Issue
- POST /api/projects/[id]/issues → src/app/api/projects/[id]/issues/route.ts
  - リクエストボディ: CreateIssueInput相当のJSON
  - CreateIssue commandを呼び出し、201 + { issueId } を返す
- GET /api/projects/[id]/issues → 同上route.tsのGET
  - クエリパラメータ: ?floorId=xxx（オプション）
  - ListIssues queryを呼び出し、IssueListItemDto[]を返す
- GET /api/projects/[id]/issues/[issueId] → src/app/api/projects/[id]/issues/[issueId]/route.ts
  - GetIssueDetail queryを呼び出し、IssueDetailDtoを返す
- PATCH /api/projects/[id]/issues/[issueId]/status → src/app/api/projects/[id]/issues/[issueId]/status/route.ts
  - リクエストボディ: { status: "Open" | "InProgress" | "Done" }
  - UpdateIssueStatus commandを呼び出す
  - 不正遷移時は400 + エラーメッセージ
- POST /api/projects/[id]/issues/[issueId]/photos → src/app/api/projects/[id]/issues/[issueId]/photos/route.ts
  - multipart/form-data でファイル受信
  - photoPhase フィールド（"Before" | "After"）も受け取る
  - AddPhoto commandを呼び出し、201 + { photoId, blobKey } を返す
- GET /api/photos/[photoId]/url → src/app/api/photos/[photoId]/url/route.ts
  - GetPhotoUrl queryで署名付きURL取得、{ url } を返す

## 共通仕様
- エラーレスポンス形式: { error: string, details?: string }
- DomainError → 400、NotFound → 404、その他 → 500
- Route Handler内ではApplication層のCommand/Queryを呼び出すのみ。ビジネスロジックは書かない。
- リクエストバリデーションは最低限（必須フィールドの存在確認）をRoute Handler側で実施。

## 確認

以下をcurl等で動作確認：
1. GET /api/projects → シードデータのプロジェクトが返る
2. GET /api/buildings → シードデータのビルが返る
3. POST /api/projects/{id}/issues で指摘作成 → 201
4. GET /api/projects/{id}/issues で作成した指摘が一覧に含まれる
5. PATCH .../status で Open→InProgress → 200
6. PATCH .../status で Open→Done → 400（不正遷移）
```

---

## Phase 6: Viewer統合 + ピン登録UI

```
## Phase 6: APS Viewer統合 + ピン登録UI

Phase 5（API Routes）が完了した。
次にAPS Viewerの3D表示とピン登録UIを実装する。
設計は docs/phase0_plan.md の §0.4（画面遷移・UI仕様）に従う。

## 前提
- APS Viewer SDK v7を使用（CDNから読み込み）
- Next.js App Router（Client Component）
- トークンは GET /api/viewer/token から取得
- ModelURNはプロジェクト→ビルディング経由で取得（API or props）

## ゴール

### 1. Viewer コンポーネント（src/app/components/viewer/）
- `aps-viewer.tsx` — APS Viewer のラッパーClient Component
  - useEffect でViewer初期化: Autodesk.Viewing.Initializer → GuiViewer3D → loadDocumentNode
  - トークン取得コールバック: /api/viewer/token を呼び出し
  - urnをpropsで受け取る
  - viewerインスタンスをrefで保持
  - クリーンアップ: useEffectのreturnでviewer.finish()

### 2. マーカー（ピン）表示
既存の指摘をViewerに表示する。以下のいずれかの方式で実装：
- 方式A: Viewer DataVisualization Extension を使用してスプライトアイコンを配置
- 方式B: Custom Overlay（HTML div をViewer上に重畳、3D→2D座標変換で位置決め）
- 方式C: Markup Extension

推奨は方式A（DataVisualization）だが、実装のしやすさで選択してよい。

マーカーの表示データ:
- 各Issueのlocation情報（dbId）からViewer上の3D位置を取得
  - dbIdの場合: viewer.model.getInstanceTree() + viewer.model.getFragmentList() でバウンディングボックス中心を算出
- マーカーにIssueのステータスで色分け（Open:赤, InProgress:黄, Done:緑 など）

### 3. ピン登録操作（新規指摘の起点）
- 3Dモデル上の部材をダブルクリック → 選択された部材のdbIdを取得
- dbId取得後、指摘登録フォーム（モーダル or 別画面）に遷移
  - dbIdとfloorId（現在選択中のフロア）をフォームに引き渡す
- Viewerのイベント: AGGREGATE_SELECTION_CHANGED or カスタムのdblclickイベントを使用
- シングルクリックはViewerのデフォルト操作（回転・選択）と競合するため、ダブルクリックを使用

### 4. マーカークリック → 詳細遷移
- マーカーをクリック → 該当Issueの詳細画面（/projects/{id}/issues/{issueId}）に遷移
- または右パネルの指摘詳細を表示

### 5. Viewer型定義
APS Viewer SDKにはTypeScript型定義がない場合がある。
- `src/types/forge-viewer.d.ts` にグローバル型定義を追加
- または @types/forge-viewer がnpmにあればインストール

## 注意
- APS_CLIENT_ID / APS_CLIENT_SECRET / APS_MODEL_URN が .env に設定されていない場合、Viewerは空表示になる。その場合でも画面がクラッシュしないようエラーハンドリングすること。
- Viewer SDKのCDN: https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js
- CSS: https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css

## 確認
1. 3Dモデルが表示される（APS情報が正しく設定されている場合）
2. 既存の指摘のマーカーが3D上に表示される
3. 部材ダブルクリックでdbIdが取得できる（console.logで確認）
4. マーカークリックで詳細遷移できる
```

---

## Phase 7: 指摘入力/一覧/位置遷移UI

```
## Phase 7: 指摘入力/一覧/位置遷移UI

Phase 6（Viewer統合）が完了した。
次に指摘管理のUI全体を実装する。
設計は docs/phase0_plan.md の §0.4（画面遷移・UI仕様）に従う。

## 画面構成（4画面）

### 画面1: プロジェクト一覧（src/app/projects/page.tsx）
- GET /api/projects からプロジェクト一覧を取得
- 表示: プロジェクト名、ステータス、指摘件数
- プロジェクトをクリック → 画面2（フロア一覧）へ遷移
- ルート: /projects

### 画面2: フロア一覧（src/app/projects/[projectId]/floors/page.tsx）
- プロジェクト情報からbuildingIdを取得
- GET /api/buildings/{buildingId}/floors からフロア一覧を取得
- 表示: フロア名、指摘件数
- フロアをクリック → 画面3（3Dビュー）へ遷移
- ルート: /projects/{projectId}/floors

### 画面3: 3Dビュー + 指摘一覧（src/app/projects/[projectId]/viewer/page.tsx）
- メインの作業画面。レイアウト:
  - 左側（70%程度）: APS Viewer（Phase 6で実装済み）
  - 右側（30%程度）: 指摘一覧パネル
- フロア選択: クエリパラメータ ?floorId=xxx、またはドロップダウンで切り替え
- 指摘一覧パネル:
  - GET /api/projects/{id}/issues?floorId=xxx で取得
  - 各行: 指摘タイトル、種別アイコン、ステータスバッジ
  - 行クリック → 指摘詳細（画面4）へ遷移
- 双方向ハイライト連動:
  - 指摘一覧の項目をマウスオーバー → Viewer上のマーカーをハイライト
  - Viewerマーカーをマウスオーバー → 指摘一覧の対応行をハイライト
  - 実装: React state でhoveredIssueIdを共有、Viewer側とリスト側で連動
- 新規指摘ボタン or ダブルクリック → 指摘登録フォーム（モーダル）
- ルート: /projects/{projectId}/viewer?floorId=xxx

### 画面4: 指摘詳細（src/app/projects/[projectId]/issues/[issueId]/page.tsx）
- GET /api/projects/{id}/issues/{issueId} で詳細取得
- 表示:
  - タイトル、説明、種別、ステータス
  - 位置情報（dbId表示）
  - 報告者、作成日時
  - 写真一覧（是正前/是正後でグループ分け）
    - 各写真は GET /api/photos/{photoId}/url で署名付きURL取得→img表示
- ステータス変更:
  - 現在のステータスに応じて遷移可能なボタンを表示
  - PATCH /api/.../status で更新
  - 不正遷移時はエラーメッセージ表示
- 写真追加:
  - ファイル選択 + photoPhase（Before/After）選択
  - POST /api/.../photos でアップロード
  - アップロード後、写真一覧を再取得
- 「3Dで見る」ボタン:
  - クリック → 画面3に遷移し、該当Issueのマーカーにフォーカス
  - Viewer側: viewer.select([dbId]) + viewer.fitToView([dbId])
- ルート: /projects/{projectId}/issues/{issueId}

### 指摘登録フォーム（モーダル or 別ページ）
- Phase 6のダブルクリックから遷移
- 入力フィールド:
  - タイトル（必須）
  - 説明（任意）
  - 種別（ドロップダウン: Quality/Safety/Construction/Design）
  - 報告者名（テキスト入力。認証未実装のため手入力）
  - 写真（ファイル選択、複数可、photoPhase=Before固定）
- dbId、floorId はダブルクリック時に自動セット（hidden）
- POST /api/projects/{id}/issues で作成
- 作成後、一覧に戻る（指摘一覧を再取得）

## UIスタイリング
- Tailwind CSS を使用（Next.jsプロジェクトに導入済みと想定。未導入なら導入する）
- モバイル対応は最低限（レスポンシブ幅調整程度）
- 色使い:
  - Open: 赤系（bg-red-100, text-red-800 等）
  - InProgress: 黄系（bg-yellow-100）
  - Done: 緑系（bg-green-100）

## 確認
1. プロジェクト一覧 → フロア一覧 → 3Dビューの画面遷移が動作する
2. 指摘一覧パネルに既存指摘が表示される
3. ダブルクリック → 登録フォーム → 指摘作成 → 一覧に反映
4. 指摘詳細でステータス変更ができる
5. 写真アップロード → 詳細画面に表示される
6. 一覧から指摘をクリック → 詳細画面が表示される
7. 「3Dで見る」→ Viewer上で該当部材にフォーカスする
```

---

## Phase 8: README・設計資料整備

```
## Phase 8: README・設計資料の整備

Phase 7（UI実装）が完了した。最終フェーズとして、提出用のREADMEと設計資料を整備する。

## 重要
この課題は「設計の質」と「設計を言語化する力」が最も重視される。READMEの品質が評価の大部分を占める。

## README.md の構成

以下の構成でREADME.mdをプロジェクトルートに作成する。
課題の §8（設計要求）の全項目を網羅すること。

### 1. プロジェクト概要
- 施工現場向け指摘管理ツールの概要（1〜2段落）
- ヒアリングから導出した課題と解決アプローチの要約

### 2. 起動手順
```
git clone ...
cp .env.example .env
# .env に APS_CLIENT_ID, APS_CLIENT_SECRET, APS_MODEL_URN を設定
docker compose up -d
npm install
npx prisma db push
npx prisma db seed
npm run dev
# http://localhost:3000 でアクセス
```
※ 実際のコマンドを検証し、正確に記載すること。

### 3. 全体アーキテクチャ（§8.1対応）
- レイヤー構成の図（docs/architecture.mmd を参照表示、またはテキスト図）
- 各層の責務を説明：
  - Presentation: UI表示、Route Handlers（HTTPの関心事のみ）
  - Application: ユースケースのオーケストレーション、DTO変換
  - Domain: ビジネスルール、集約、状態遷移、Value Objects
  - Infrastructure: 外部システムとの接続（DB、Blob、APS）
- 依存方向: Presentation → Application → Domain ← Infrastructure
- 依存性逆転の説明: Domain層のInterfaceをInfrastructure層が実装
- フレームワーク依存の隔離: Next.js/Prisma/MinIOへの依存はInfrastructure層に閉じ込め

### 4. ドメイン設計（§8.2対応）
- Issue集約の責務と構造
- 状態遷移ルールとその実装場所（Issue集約内メソッド）
  - 許可される遷移と禁止される遷移（Open→Done禁止）の説明
- Location Value Object: 部材指摘と空間指摘の両対応設計（現時点では部材のみ実装、空間は将来対応）
- ビジネスルールの所在: Domain層に集中、Application層はオーケストレーションのみ
- ER図への参照（docs/er-diagram.mmd）

### 5. 読み取りと書き込みの整理（§8.3対応）
- Command: Issue作成、ステータス変更、写真追加 → Domain集約経由で整合性担保
- Query: 一覧取得、詳細取得 → DB直接読み取り（集約不経由）
- なぜ分けるか: 読み取りで集約を経由するとN+1やパフォーマンス劣化の原因になる
- 件数増加時の方針: Query側にRead Model（Materialized View/検索用テーブル）を分離可能な構造

### 6. 永続化戦略（§8.4対応）
- Repositoryパターン: Domain層にInterface、Infrastructure層にPrisma実装
- DB依存の隔離: Prismaの型はInfrastructure層内に留め、Domain↔Prismaの変換はRepository内で行う
- Blob保存戦略:
  - キー命名: `projects/{projectId}/issues/{issueId}/photos/{photoId}.{ext}`
  - DBにはBlobKeyのみ保持、URLは動的生成（署名付き）
- DBとBlobの整合性:
  - Blob先行書き込み → DB記録の順序
  - 失敗時は孤立Blobが残る可能性あり → 本番では定期クリーンアップジョブで対応

### 7. 外部依存の隔離（§8.5対応）
- APS依存:
  - ViewerTokenProvider interface（Domain層）→ ApsViewerTokenProvider（Infrastructure層）
  - Viewer SDK自体はPresentation層（UIの関心事）
  - トークン取得のみバックエンド経由
- ストレージ依存:
  - PhotoStorage interface（Domain層）→ MinioPhotoStorage（Infrastructure層）
  - 本番ではAzure Blob StorageやS3に差し替え可能

### 8. 将来本番構成（§8.6対応）
docs/phase0_plan.md §0.12 の内容を元に記載：
- クラウド構成: Azure or AWS
- 認証: Azure AD B2C / Auth0
- マルチユーザー: TenantId + RLS
- ロール・割振り: Reporter/Manager/Worker + Assignee
- 大量データ: Read Model分離、ページネーション
- Blob: CDN配信、サムネイル自動生成

### 9. 設計判断の記録（ADR）
docs/phase0_plan.md §0.13 から主要な判断を記載：
- Next.js単体構成の理由（16h制約 vs 本番想定）
- BlobKey方式の採用理由
- Location情報のカラム分割（JSON列不採用）の理由
- 状態遷移ルールのDomain配置
- Assignee未実装の判断根拠

### 10. ディレクトリ構成
実際の `tree` コマンド出力（主要部分）を記載。各ディレクトリの役割を簡潔に注釈。

### 11. API仕様
docs/api-design.md への参照、または主要エンドポイントの概要表。

## 追加資料

### docs/api-design.md
§0.10のAPI設計を詳細化。各エンドポイントのリクエスト/レスポンス例を含む。
既に docs/ にある architecture.mmd, er-diagram.mmd はそのまま維持。

## 確認

1. READMEの起動手順に従って、クリーンな状態から起動できること（実際にコマンドを実行して検証）
2. 課題 §8 の全項目（8.1〜8.6）がREADMEに記載されていること
3. ER図、アーキテクチャ図がdocs/に存在すること
4. API設計資料がdocs/に存在すること
```

---

## 補足：Phase間の受け渡し確認

各Phaseの冒頭に「Phase N が完了した」と記載しているので、Claude Codeは前Phaseの成果物をファイルシステムから確認できる。
万が一、前Phaseの成果物に問題があった場合は、Claude Codeがその場で修正してから次に進むことを期待できる。

推奨ワークフロー：
1. Phase完了ごとに `git add -A && git commit -m "Phase N: ..."` を実行するようClaude Codeに指示する
2. これによりPhase単位でのロールバックが可能になる
