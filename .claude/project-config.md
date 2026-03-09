# プロジェクト設定（スキル共通参照ファイル）

各スキル（`/gen-test-spec`, `/gen-test-code`, `/run-test`, `/fix-test`, `/fix-prod`, `/commit-push`）は
このファイルからプロジェクト固有の設定を読み取る。
別プロジェクトに移植する場合はこのファイルのみ書き換える。

---

## テストツールチェイン

| 種別 | ツール | 実行コマンド |
|------|-------|------------|
| Unit/Integration | Vitest | `npx vitest run --reporter=verbose 2>&1` |
| E2E | Playwright | `npx playwright test --reporter=list 2>&1` |

### テストファイルパターン
- Unit/Integration: `src/**/*.test.ts`
- E2E: `e2e/*.spec.ts`

### E2E 前提条件
- Docker（PostgreSQL + MinIO）が起動していること
- dev server が起動していること

---

## 設計仕様ドキュメント

| ドキュメント | パス | 用途 |
|------------|------|------|
| 設計仕様 | `docs/phase0_plan.md` | ドメインルール、状態遷移、ビジネスロジックの定義 |
| API 仕様 | `docs/api-design.md` | エンドポイント一覧、リクエスト/レスポンス定義 |
| アーキテクチャ原則 | `CLAUDE.md` | レイヤー構造、依存方向、CQRS 等の設計原則 |
| テスト仕様書 | `docs/test-spec.md` | 生成されたテストケース定義 |

---

## レイヤー構造

| レイヤー | パス | エージェント（subagent_type） | commit prefix |
|---------|------|---------------------------|---------------|
| Domain | `src/domain/` | `domain-architect` | `feat(domain):` / `fix(domain):` |
| Application | `src/application/` | `application-engineer` | `feat(application):` / `fix(application):` |
| Infrastructure | `src/infrastructure/`, `prisma/` | `infrastructure-engineer` | `feat(infra):` / `fix(infra):` |
| Presentation (API/UI) | `src/app/` | `frontend-engineer` | `feat(api):` / `feat(ui):` / `fix(api):` |
| ドキュメント | `docs/`, `README.md` | `doc-writer` | `docs:` |
| 設定 | `.env.example`, `docker-compose.yml`, `*.config.*` | - | `chore:` |
| テスト | `**/*.test.*`, `**/*.spec.*` | `test-fixer` | `test:` |
| 複数レイヤー | - | `reviewer` で分析後、各レイヤーのエージェントを順次起動 | - |

---

## 実装コードの探索パス

Truth Matrix 生成時にスキャンする対象:

```
src/domain/models/        # ドメインモデル
src/domain/services/      # ドメインサービス
src/application/commands/  # Command ハンドラ
src/application/queries/   # Query ハンドラ
src/app/api/              # API Route Handlers
```

### エンドポイント網羅性チェック対象
- 仕様定義: `docs/api-design.md` の全エンドポイント
- 実装: `src/app/api/**/route.ts` の全ファイル

---

## スコープ別テストファイル対応表

| スコープ | Unit/Integration | E2E |
|---------|-----------------|-----|
| `issue` | issue.test.ts, issue-commands.test.ts | issues.spec.ts |
| `organization` | organization.test.ts, org-commands.test.ts | admin.spec.ts |
| `user` | user.test.ts, user-commands.test.ts | admin.spec.ts |
| `auth` | - | auth.spec.ts, permissions.spec.ts |
| `api` | `src/app/api/**/*.test.ts` | - |
| `e2e` | - | `e2e/*.spec.ts`（全ファイル） |
| `domain` | `src/domain/models/*.test.ts` | - |
| `unit` | `src/**/*.test.ts`（全ファイル） | - |
| `全体` | 全 Unit/Integration | 全 E2E |

---

## スコープ別の修正対象ガイド（`/fix-prod` 用）

| スコープ | 主要プロダクションファイル | レイヤー |
|---------|------------------------|---------|
| `issue` | issue.ts, update-issue-status.ts, create-issue.ts | Domain, Application |
| `organization` | organization.ts, create-organization.ts, delete-organization.ts | Domain, Application |
| `user` | user.ts, create-user.ts, deactivate-user.ts | Domain, Application |
| `auth` | permission-service.ts, requireRole middleware | Domain, Application |
| `api` | src/app/api/**/*.ts | Presentation |
| `progress` | list-projects.ts | Application |
| `domain` | src/domain/models/*.ts | Domain |

---

## スコープ別の仕様参照ガイド（`/gen-test-spec` 用）

| スコープ | phase0 参照セクション | 主要実装ファイル |
|---------|-------------------|----------------|
| `issue` | §0.5 状態遷移, §0.8 写真 | issue.ts, update-issue-status.ts, add-photo.ts |
| `organization` | §0.3 組織, §0.13 | organization.ts, create-organization.ts, delete-organization.ts |
| `user` | §0.3 ユーザー | user.ts, create-user.ts, deactivate-user.ts |
| `auth` | §0.12 認可, API認可マトリクス | permission-service.ts, requireRole middleware |
| `api` | 全APIセクション | src/app/api/**/*.ts |
| `progress` | §0.7 進捗率, §0.9 Worker | list-projects.ts |
| `domain` | §0.3-§0.8 | src/domain/models/*.ts |
| `全体` | 全セクション | 全ファイル |

---

## E2E フィクスチャ・ヘルパー

| ファイル | 用途 |
|---------|------|
| `e2e/fixtures/auth.ts` | ロール別認証フィクスチャ（adminPage, supervisorPage, workerPage） |
| `e2e/fixtures/test-data.ts` | SEED 定数（テストデータのID等） |

---

## 既存テストファイルパターン（重複防止用）

Unit/Integration:
- `src/domain/models/*.test.ts`
- `src/application/commands/*.test.ts`
- `src/application/queries/*.test.ts`
- `src/app/api/**/*.test.ts`

E2E:
- `e2e/*.spec.ts`
