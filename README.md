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
- 5段階ステータス: PointOut / Open / InProgress / Done / Confirmed
- 許可遷移:
  - PointOut -> Open（Assignee 設定）
  - Open -> InProgress（着手）
  - InProgress -> Done（是正完了。是正後写真1枚以上必要）
  - InProgress -> Open（差し戻し）
  - Done -> Confirmed（Supervisor 承認）
  - Done -> Open（否認。コメント必須）
  - Confirmed -> Open（再指摘。コメント必須）
- 禁止遷移:
  - Open -> Done（`InvalidStatusTransitionError`）
  - PointOut -> InProgress（Assignee 設定を経由すること）
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
- ロール: Admin / Supervisor / Worker + Assignee
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

## 10. 設計仕様書

本プロジェクトの詳細設計仕様は `doc/phase0_plan.md` に記述されている。実装に先立ってすべての要件・ドメインモデル・ADRを言語化したものであり、以下の主要な拡張設計が含まれる。

- **Organization と User のドメインモデル**: Organization（Headquarters / Branch の1階層構造）と User（Admin / Supervisor / Worker の3ロール）を導入。本部が支部を管理し、支部がプロジェクト・建造物・ユーザーを管理する構造を定義している。
- **5段階ステータス**: Issue の状態を PointOut / Open / InProgress / Done / Confirmed の5段階で管理する。最低要件の3段階（Open / InProgress / Done）からの拡張であり、「担当者未定」（PointOut）と「監督承認済み」（Confirmed）を明示的に区別するための判断（ADR 判断6）。この5段階ステータスは現在の実装にも反映済みで、`src/domain/models/issue.ts` の `IssueStatus` enum に実装されている。
- **StatusChangeLog（状態変更履歴）**: Issue の全状態変更を記録するエンティティ。否認理由（コメント）も StatusChangeLog に保持する。「履歴を追いたい」というヒアリング要件に直接対応（ADR 判断7）。`src/domain/models/status-change-log.ts` として実装済み。
- **ロールベース権限ルール**: 指摘登録は Supervisor のみ、Assignee への割り振りも Supervisor のみ、是正完了の確認・否認は Supervisor のみ、Worker は自身が Assignee の場合のみ着手・完了操作が可能、という詳細なルールをドメイン内で定義。Application 層が認可チェックを担当し、Domain 層が権限ルールを定義する責務分担（ADR 判断11）。
- **ADR（設計判断記録）13件**: Next.js 単体構成の選択、BlobKey 方式の採用、Location 情報のカラム分割、状態遷移の Domain 配置、5段階ステータスの拡張、StatusChangeLog の導入、Organization・User の導入など、13の設計判断とその根拠を記録している。
- **画面遷移・UI仕様**: ログイン、管理ダッシュボード、プロジェクト一覧、フロア一覧、3Dビュー（双方向ハイライト連動）、指摘詳細（StatusChangeLog タブ含む）の6画面構成とその詳細仕様。
- **実装フェーズ計画**: Phase 0（設計）から Phase 9（ドキュメント整備）まで全10フェーズの実装計画と工数見積もり。

なお、CLAUDE.md に記載の基本仕様との相違点として、CLAUDE.md では状態遷移を Open / InProgress / Done の3段階と記述しているが、`doc/phase0_plan.md` の拡張設計（ADR 判断6）に基づき、実装では PointOut / Open / InProgress / Done / Confirmed の5段階として実装されている。

## 11. ディレクトリ構成
```text
.
|- .claude/
|  |- agents/            # レイヤー別 AI エージェント定義
|- doc/
|  |- architecture.mmd
|  |- er-diagram.mmd
|  |- phase0_plan.md     # 詳細設計仕様書（セクション10参照）
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

## 12. API仕様
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

## 13. AI活用: エージェント構成

本プロジェクトでは Claude Code の Agent 機能を活用し、`.claude/agents/` にアーキテクチャ層と1対1で対応したサブエージェントを定義した。各エージェントはファイル所有権を明確に分離されており、PM（メインセッション）がオーケストレーション・レビュー・統合テストと最終設計判断を担当する。

### エージェント一覧

| エージェント名 | 担当レイヤー | 使用モデル | 責務概要 |
|---------------|------------|-----------|---------|
| domain-architect | Domain（`src/domain/`） | opus | Issue 集約・状態遷移・Value Object・Repository/Storage/Auth インターフェースの実装。外部依存ゼロを厳守。 |
| infrastructure-engineer | Infrastructure（`src/infrastructure/`、`prisma/`、`docker-compose.yml`） | sonnet | Prisma スキーマ・具象 Repository・MinIO PhotoStorage・APS TokenProvider・NextAuth プロバイダー・シードデータ・Docker 構成の実装。 |
| application-engineer | Application（`src/application/`） | haiku | Command/Query ハンドラ・DTO・認可チェックの実装。Domain 集約を経由した Command と DB 直接読み取りの Query を分離する CQRS ルールを守る。 |
| frontend-engineer | Presentation（`src/app/`） | sonnet | Next.js App Router ページ・UI コンポーネント・APS Viewer SDK 統合・API Route Handlers の実装。 |
| doc-writer | ドキュメント（`README.md`、`docs/`） | sonnet | README・アーキテクチャ図・ER 図・API 設計書の作成・維持。ソースコードを読んで実装の実態を反映する。 |
| phase-planner | 計画（実装不要） | - | 実装フェーズごとの計画書（`C:\Users\prove\.claude\plans\phase-{N}-plan.md`）を生成し、PM へのエージェントチーム指示プロンプトを出力する事前計画専門エージェント。コードは書かない。 |
| project-manager | 統合・調整（メインセッション） | - | エージェントチームへのタスク割り当て・進捗管理・アーキテクチャ一貫性の守護・最終設計判断。 |

### レイヤーとエージェントの1対1対応

エージェントをアーキテクチャ層と1対1で対応させた設計意図は、「層をまたいだ依存関係の混入」を構造的に防ぐことにある。各エージェントはファイル所有権が厳密に定められており、別層のファイルを書き換えることを Absolute Rules として禁止している。これにより、AI が誤って Domain 層に Prisma を import したり、Infrastructure 層にビジネスルールを書いてしまうリスクを設計レベルで排除した。

### モデル選択の方針

Domain 層（domain-architect）には opus を割り当てた。状態遷移の禁止ルール、権限ルール、Value Object の不変性など、最も複雑なビジネスロジックの推論が求められるためである。Infrastructure 層・Presentation 層・ドキュメント（infrastructure-engineer / frontend-engineer / doc-writer）には sonnet を割り当てた。実装量が多く、十分な品質を確保しながらコストを抑える判断である。Application 層（application-engineer）には haiku を割り当てた。Command/Query ハンドラはオーケストレーション中心で推論の複雑度が低く、haiku で対応できると判断した。

### PM の役割: レビュー・統合テスト・最終設計判断

PM（メインセッション）はコードを直接書かず、以下を担当する。

- サブエージェントへのタスク割り当てと実行順序の管理（Agent A → Agent B+C 並行 → Agent D）
- 各エージェントの成果物のレビューと依存方向の検証
- 統合テスト（ビルド通過・API 疎通・UI 動作確認）
- AI の出力に対する人間判断での上書き

実際の設計判断の例として、ADR 判断5（Organization・User の導入）では、Arent 担当者への確認が取れなかった状況で PM が「現場の実運用に必要」と判断して拡張を進めた。ADR 判断6（5段階ステータスの導入）も同様に、AI エージェントが生成した3段階の初期モデルに対して PM が「PointOut と Confirmed の欠落は実運用上の欠陥」と判断し、5段階への拡張を指示したものである。これらの判断は `doc/phase0_plan.md` のセクション 0.13 に記録されている。
