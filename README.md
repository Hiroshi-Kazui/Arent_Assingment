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

## 3. テスト用アカウント

`npx prisma db seed` 実行後、以下のアカウントでログインできます。

| ロール | メールアドレス | パスワード | 権限概要 |
|--------|--------------|-----------|---------|
| ADMIN | `admin@example.com` | `password123` | 組織・ユーザー管理（`/admin`） |
| SUPERVISOR | `sup@example.com` | `password123` | 指摘作成・担当割当・ステータス変更・承認 |
| WORKER | `worker@example.com` | `password123` | 写真アップロード・ステータス変更（担当案件のみ） |

## 4. 全体アーキテクチャ（§8.1）
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

## 5. ドメイン設計（§8.2）
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
- Domain 層は外部依存ゼロのため、Prisma・MinIO・NextAuth なしで純粋なユニットテストが可能。`src/domain/models/issue.test.ts` に状態遷移ルール（31テスト）を実装済み。Application 層の統合テスト（`src/application/commands/issue-commands.test.ts`）も含め計5ファイル・約850行のテストコードが存在する。

## 6. 読み取りと書き込みの整理（§8.3）
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

## 7. 永続化戦略（§8.4）
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

## 8. 外部依存の隔離（§8.5）
- APS:
  - `ViewerTokenProvider` interface -> `ApsTokenProvider`
  - Viewer SDK 自体は Presentation（UI）責務
- Storage:
  - `PhotoStorage` interface -> `MinioPhotoStorage`
  - S3/Azure Blob へ差し替え可能な構造

## 9. 将来本番構成（§8.6）
- クラウド: Azure または AWS
- 認証: Azure AD B2C / Auth0
- マルチテナント: `tenant_id` + RLS
- ロール: Admin / Supervisor / Worker + Assignee
- 大量データ対策: Read Model 分離、ページネーション
- Blob配信: CDN + サムネイル自動生成

## 10. 設計判断（ADR）

全14件の設計判断を記録する。詳細は `doc/phase0_plan.md` セクション 0.13 を参照。

- **判断1: Next.js 単体構成**:
  - 16h 制約のため Next.js 単体を採用。設計上のレイヤー分離はディレクトリ構成で担保し、README に「本番では .NET バックエンドに分離」と明記する方針。
- **判断2: BlobKey 方式**:
  - URL 永続化を避け、ストレージ差替え耐性を確保。署名付き URL を動的生成することでセキュリティも担保。
- **判断3: 位置情報のカラム分割**:
  - JSON 一括保持より検索性・制約定義が明確。`locationType + dbId + worldPositionX/Y/Z` の正規化カラムを採用。
- **判断4: 状態遷移の Domain 配置**:
  - ビジネスルールはドメインに閉じ込める。API/UI で重複する遷移判定を Issue 集約内のメソッドに集約し、Application 層はオーケストレーションのみ担当。
- **判断5: Assignee を最低要件に含めない**:
  - 課題資料のワイヤーフレームに Assignee フィールドが定義されていないため MVP では割愛。ロール体系・ワークフローは拡張フェーズで追加。拡張可能なドメインモデルだけ先行定義。
- **判断6: Building/Floor/Project の管理 API を実装しない**:
  - 指摘管理 CRUD に集中するため、マスタデータはシード投入で代替。ドメインモデルは正しく定義し、将来の CRUD 追加に備える。
- **判断7: ModelUrn を Building に配置**:
  - 1 建造物に対して 1 統合 BIM モデルが存在する構造のため Building に配置。フロア選択は Viewer 側のセクションボックスフィルタで対応。
- **判断8: 空間指摘（worldPosition）を今回実装しない**:
  - 担当者への確認で Nice to have であることを確認済み。ただし課題資料 4.3「両対応が望ましい」に対し、Location Value Object で将来追加時にドメイン変更不要な構造を維持。
- **判断9: BIM の level プロパティを信頼せず Z 座標ベースでフロア判定**:
  - 実際の BIM データで level プロパティの不整合を確認（B1F 配管に level:4F）。BoundingBox 底面 Z 座標で判定し、結果を ElementFloorMapping テーブルに登録する方式を採用。実装時に判断14でアプローチを改訂。
- **判断10: 5段階ステータスへの拡張**:
  - 最低要件の3段階（Open / InProgress / Done）から、PointOut / Open / InProgress / Done / Confirmed の5段階に拡張。「担当者未定」（PointOut）と「監督承認済み」（Confirmed）の欠落は実運用上の欠陥と PM が判断し拡張を指示。現在の実装に反映済み。
- **判断11: Organization・User の導入**:
  - Headquarters / Branch の1階層組織構造と Admin / Supervisor / Worker の3ロールを導入。現場の実運用に「指摘者と是正作業者は別」「協力会社も管理したい」という要求が存在すると PM が判断し拡張。
- **判断12: ロールベース認可の Application 層配置**:
  - 認可チェックは Application 層（Command/Query ハンドラ）が担当し、Domain 層は権限ルールの定義に留める責務分担を採用。Domain 層を外部フレームワーク依存から守りつつ、ビジネスルールとしての権限定義をドメインに残す。
- **判断13: NextAuth Credentials Provider の採用**:
  - 本番では Azure AD B2C / Auth0 を想定しつつ、開発環境での検証容易性を優先して Credentials Provider を採用。NextAuth の抽象化により将来の OAuth プロバイダー差し替えが可能な構造を維持。
- **判断14: フロア・部材マッピング取得戦略の変更（AEC LevelsExtension → Model Derivative API + BoundingBox Z）**:
  - 当初は AEC LevelsExtension からレベル・標高を取得する計画だったが、対象モデルが MEP（設備）モデルであり AEC LevelsExtension のデータが存在しなかった。また AEC Model Data エンドポイントも 404 を返し、プロパティ値（上面の高さ等）は参照レベルからのオフセット値であり絶対標高ではなかった。そこで以下の2段階アプローチに変更した:
  - **Stage 1（サーバーサイド）**: APS Model Derivative API の全プロパティから「参照レベル」のユニーク値を抽出しフロアレコードを作成。基準レベル（設計GL等）はフロアではないため除外。
  - **Stage 2（クライアントサイド）**: Viewer 起動時に全リーフノードの BoundingBox 底面 Z を取得し、Z 値の分布をフロア数で均等分割して各フロアの標高を推定。全部材を BoundingBox Z のみでフロアに割り当てる（参照レベルプロパティはモデル作成者依存のため使用しない。判断9の方針と一貫）。結果はバックエンドに非同期永続化し、2回目以降はキャッシュから読み込む。
  - この判断は BIM モデルの種類（建築/設備/構造）によって利用可能な API やメタデータが異なるという実データ検証から導かれた設計適応である。
- **判断15: トランザクション境界と楽観ロックの設計方針**:
  - 16時間制約のため、楽観ロック（version カラム）は未実装。現状は Prisma の暗黙トランザクションと Blob-first 戦略で整合性を担保。本番では Issue 集約に `version` フィールドを追加し、同時更新の衝突を検知する楽観ロックを導入する設計を想定。Blob + DB の跨ぎ操作については Outbox パターンによる結果整合性への移行を計画（詳細は `docs/architecture.md` §8.6, §10.6）。

## 11. 設計仕様書

本プロジェクトの詳細設計仕様は `doc/phase0_plan.md` に記述されている。実装に先立ってすべての要件・ドメインモデル・ADRを言語化したものであり、以下の主要な拡張設計が含まれる。

- **Organization と User のドメインモデル**: Organization（Headquarters / Branch の1階層構造）と User（Admin / Supervisor / Worker の3ロール）を導入。本部が支部を管理し、支部がプロジェクト・建造物・ユーザーを管理する構造を定義している。
- **5段階ステータス**: Issue の状態を PointOut / Open / InProgress / Done / Confirmed の5段階で管理する。最低要件の3段階（Open / InProgress / Done）からの拡張であり、「担当者未定」（PointOut）と「監督承認済み」（Confirmed）を明示的に区別するための判断（ADR 判断6）。この5段階ステータスは現在の実装にも反映済みで、`src/domain/models/issue.ts` の `IssueStatus` enum に実装されている。
- **StatusChangeLog（状態変更履歴）**: Issue の全状態変更を記録するエンティティ。否認理由（コメント）も StatusChangeLog に保持する。「履歴を追いたい」というヒアリング要件に直接対応（ADR 判断7）。`src/domain/models/status-change-log.ts` として実装済み。
- **ロールベース権限ルール**: 指摘登録は Supervisor のみ、Assignee への割り振りも Supervisor のみ、是正完了の確認・否認は Supervisor のみ、Worker は自身が Assignee の場合のみ着手・完了操作が可能、という詳細なルールをドメイン内で定義。Application 層が認可チェックを担当し、Domain 層が権限ルールを定義する責務分担（ADR 判断11）。
- **ADR（設計判断記録）14件**: Next.js 単体構成の選択、BlobKey 方式の採用、Location 情報のカラム分割、状態遷移の Domain 配置、5段階ステータスの拡張、StatusChangeLog の導入、Organization・User の導入、フロア取得戦略の変更（MEPモデル対応）など、14の設計判断とその根拠を記録している。
- **画面遷移・UI仕様**: ログイン、管理ダッシュボード、プロジェクト一覧、フロア一覧、3Dビュー（双方向ハイライト連動）、指摘詳細（StatusChangeLog タブ含む）の6画面構成とその詳細仕様。
- **実装フェーズ計画**: Phase 0（設計）から Phase 9（ドキュメント整備）まで全10フェーズの実装計画と工数見積もり。

なお、CLAUDE.md に記載の基本仕様との相違点として、CLAUDE.md では状態遷移を Open / InProgress / Done の3段階と記述しているが、`doc/phase0_plan.md` の拡張設計（ADR 判断6）に基づき、実装では PointOut / Open / InProgress / Done / Confirmed の5段階として実装されている。

## 12. ディレクトリ構成
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

## 13. API仕様
詳細は `doc/api-design.md` を参照。

### Buildings
| Method | Path |
|--------|------|
| GET | `/api/buildings` |
| GET | `/api/buildings/{buildingId}/floors` |
| PATCH | `/api/buildings/{buildingId}/floors` |
| GET/POST | `/api/buildings/{buildingId}/sync-levels` |
| GET | `/api/buildings/{buildingId}/element-floor-mapping/{dbId}` |
| POST | `/api/buildings/{buildingId}/element-floor-mapping` |

### Projects
| Method | Path |
|--------|------|
| GET | `/api/projects` |
| GET | `/api/projects/{id}` |
| POST | `/api/projects` |
| PATCH | `/api/projects/{id}` |

### Issues
| Method | Path |
|--------|------|
| POST | `/api/projects/{id}/issues` |
| GET | `/api/projects/{id}/issues` |
| GET | `/api/projects/{id}/issues/{issueId}` |
| PATCH | `/api/projects/{id}/issues/{issueId}` |
| DELETE | `/api/projects/{id}/issues/{issueId}` |
| PATCH | `/api/projects/{id}/issues/{issueId}/status` |
| PATCH | `/api/projects/{id}/issues/{issueId}/assignee` |

### Photos
| Method | Path |
|--------|------|
| POST | `/api/projects/{id}/issues/{issueId}/photos` |
| GET | `/api/photos/{photoId}/url` |

### Viewer
| Method | Path |
|--------|------|
| GET | `/api/viewer/token` |

### Auth
| Method | Path |
|--------|------|
| GET | `/api/auth/me` |
| POST | `/api/auth/[...nextauth]` |

### Organizations
| Method | Path |
|--------|------|
| GET | `/api/organizations` |
| POST | `/api/organizations` |
| PATCH | `/api/organizations/{id}` |
| DELETE | `/api/organizations/{id}` |

### Users
| Method | Path |
|--------|------|
| GET | `/api/users` |
| POST | `/api/users` |
| GET | `/api/users/{id}` |
| PATCH | `/api/users/{id}` |
| DELETE | `/api/users/{id}` |

### AssignableUsers
| Method | Path |
|--------|------|
| GET | `/api/assignable-users` |

## 14. AI活用: エージェント構成

本プロジェクトでは Claude Code の Agent 機能を活用し、`.claude/agents/` にアーキテクチャ層と1対1で対応したサブエージェントを定義した。各エージェントはファイル所有権を明確に分離されており、PM（メインセッション）がオーケストレーション・レビュー・統合テストと最終設計判断を担当する。

### エージェント一覧

| エージェント名 | 担当レイヤー | 使用モデル | 責務概要 |
|---------------|------------|-----------|---------|
| domain-architect | Domain（`src/domain/`） | opus | Issue 集約・状態遷移・Value Object・Repository/Storage/Auth インターフェースの実装。外部依存ゼロを厳守。 |
| infrastructure-engineer | Infrastructure（`src/infrastructure/`、`prisma/`、`docker-compose.yml`） | sonnet | Prisma スキーマ・具象 Repository・MinIO PhotoStorage・APS TokenProvider・NextAuth プロバイダー・シードデータ・Docker 構成の実装。 |
| application-engineer | Application（`src/application/`） | haiku | Command/Query ハンドラ・DTO・認可チェックの実装。Domain 集約を経由した Command と DB 直接読み取りの Query を分離する CQRS ルールを守る。 |
| frontend-engineer | Presentation（`src/app/`） | sonnet | Next.js App Router ページ・UI コンポーネント・APS Viewer SDK 統合・API Route Handlers の実装。 |
| doc-writer | ドキュメント（`README.md`、`docs/`） | sonnet | README・アーキテクチャ図・ER 図・API 設計書の作成・維持。ソースコードを読んで実装の実態を反映する。 |
| reviewer | 全レイヤー（読み取り専用） | sonnet | 仕様と実装のギャップ分析・コードレビュー・権限ルール監査。ファイルの変更は一切行わない。 |
| project-manager | 統合・調整 | opus | `/team-dispatch` や `/impl-plan` スキルが出力した PM プロンプトを受け取り、TeamCreate でエージェントチームを組成・実行するオーケストレーター。 |

### スキル（スラッシュコマンド）一覧

`.claude/commands/` に定義したスキルで、PM の定型作業を自動化する。

| コマンド | 概要 |
|---------|------|
| `/commit-push` | 未コミット変更を論理グループに分割し、Conventional Commits 形式でコミット＆プッシュ |
| `/plan-phase N` | `doc/phase0_plan.md` の対象フェーズを読み、実装計画書を生成して project-manager への投げ込みプロンプトを出力 |
| `/impl-plan [scope]` | 仕様と現在の実装を比較してギャップを分析し、実装計画書を生成して project-manager への投げ込みプロンプトを出力 |
| `/team-dispatch [plan-file]` | 作業プランをエージェント別に分割し、Wave ごとの並行実行プランファイルと project-manager へのプロンプトを出力 |

### 典型的なワークフロー

```
1. /impl-plan              → ギャップ分析 + 計画書生成 + PMプロンプト出力
2. Agent(project-manager)  → TeamCreate でエージェントチームを組成・実行
3. /commit-push            → 成果をコミット＆プッシュ
```

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
