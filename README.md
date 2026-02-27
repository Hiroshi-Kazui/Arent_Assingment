# 施工現場向け指摘管理ツール

## 1. プロジェクト概要
本プロジェクトは、施工現場で発生する指摘事項（品質・安全・施工・設計）を一元管理するための Web アプリケーションです。3D モデル（APS Viewer）上の部材と指摘を紐付け、一覧・詳細・ステータス遷移・写真管理までを一連で扱えるようにしています。

要件ヒアリングから、現場での課題を「指摘の位置特定が曖昧」「進捗把握が遅い」「写真管理が分散」の3点と捉え、ドメインルールを Domain 層に集約しつつ、UI では 3D 表示とリストを連動させる設計を採用しました。

## 2. 起動手順
```bash
git clone <repo>
cd Assignment
cp .env.example .env
# .env に APS_CLIENT_ID, APS_CLIENT_SECRET, APS_MODEL_URN を設定

docker compose up -d
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
# http://localhost:3000
```

## 3. 全体アーキテクチャ（§8.1）
- 参照図: `doc/architecture.mmd`
- レイヤ責務:
  - Presentation: Next.js UI / Route Handlers、HTTP入出力
  - Application: Command/Query のユースケース調停、DTO変換
  - Domain: 集約・Value Object・状態遷移などのビジネスルール
  - Infrastructure: Prisma/MinIO/APS など外部依存の実装
- 依存方向:
  - Presentation -> Application -> Domain
  - Infrastructure -> Domain（Repository/Provider の実装）
- 依存性逆転:
  - Domain の interface を Infrastructure が実装し、具象依存を逆転
- フレームワーク依存の隔離:
  - Next.js/Prisma/MinIO/APS は Domain から分離

## 4. ドメイン設計（§8.2）
- `Issue` 集約が状態遷移を管理
- 許可遷移:
  - Open -> InProgress
  - InProgress -> Done
  - InProgress -> Open
  - Done -> InProgress
- 禁止遷移:
  - Open -> Done（`InvalidStatusTransitionError`）
- `Location` Value Object:
  - `dbId`（部材指摘）
  - `worldPosition(x,y,z)`（空間指摘）
- ビジネスルールは Domain 層へ集中
- 参照図: `doc/er-diagram.mmd`

## 5. 読み取りと書き込みの整理（§8.3）
- Command:
  - 指摘作成
  - ステータス更新
  - 写真追加
  - いずれも Domain/Repository 経由で整合性担保
- Query:
  - 一覧・詳細は Prisma 直接読み取りで最適化
- 分離理由:
  - 読み取りで集約を経由し続けると N+1 と複雑化を招くため
- 将来拡張:
  - 件数増大時は Read Model（検索用テーブル・MV）へ分離可能

## 6. 永続化戦略（§8.4）
- Repository パターン:
  - Domain interface + Infrastructure 実装
- Prisma 型の閉じ込め:
  - Domain モデルと Prisma モデルは Repository で変換
- Blob 保存:
  - キー: `projects/{projectId}/issues/{issueId}/photos/{photoId}.{ext}`
  - DB には `blob_key` を保持し、URL は署名付きで動的発行
- DB/Blob 整合:
  - Blob 先行書き込み -> DB 記録
  - 失敗時の孤立 Blob は運用でクリーンアップジョブ想定

## 7. 外部依存の隔離（§8.5）
- APS:
  - `ViewerTokenProvider` interface -> `ApsTokenProvider`
  - Viewer SDK 自体は Presentation（UI）責務
- Storage:
  - `PhotoStorage` interface -> `MinioPhotoStorage`
  - S3/Azure Blob へ差し替え可能な構造

## 8. 将来本番構成（§8.6）
- クラウド: Azure または AWS
- 認証: Azure AD B2C / Auth0
- マルチテナント: `tenant_id` + RLS
- ロール: Reporter / Manager / Worker + Assignee
- 大量データ対策: Read Model 分離、ページネーション
- Blob配信: CDN + サムネイル自動生成

## 9. 設計判断（ADR）
- Next.js 単体構成:
  - 制限時間内で一体開発しつつ、層分離で将来分割可能にする
- BlobKey 方式:
  - URL 永続化を避け、ストレージ差替え耐性を確保
- 位置情報のカラム分割:
  - JSON 一括保持より検索性・制約定義が明確
- 状態遷移の Domain 配置:
  - API/UI で重複する遷移判定を集約
- Assignee 未実装:
  - MVP で優先度を落とし、拡張可能なモデルだけ先行

## 10. ディレクトリ構成
```text
.
|- doc/
|  |- architecture.mmd
|  |- er-diagram.mmd
|  |- phase0_plan.md
|  |- api-design.md
|- prisma/
|  |- schema.prisma
|  |- seed.ts
|- src/
|  |- app/               # Next.js pages + API routes + components
|  |- application/       # Command/Query/DTO/DI
|  |- domain/            # Entity/Aggregate/VO/Error/Repository interfaces
|  |- infrastructure/    # Prisma/MinIO/APS implementations
|  |- types/             # forge-viewer 型定義
|- docker-compose.yml
|- README.md
```

## 11. API仕様
詳細は `doc/api-design.md` を参照。

主なエンドポイント:
- `GET /api/projects`
- `GET /api/projects/{id}`
- `GET /api/buildings`
- `GET /api/buildings/{buildingId}/floors`
- `GET /api/projects/{id}/issues`
- `POST /api/projects/{id}/issues`
- `PATCH /api/projects/{id}/issues/{issueId}/status`
- `POST /api/projects/{id}/issues/{issueId}/photos`
- `GET /api/photos/{photoId}/url`
- `GET /api/viewer/token`
