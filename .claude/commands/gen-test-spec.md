# テスト仕様書生成パイプライン

対象スコープ（省略可）: $ARGUMENTS

## このスキルの目的

設計仕様（phase0_plan.md, api-design.md）と実装コードをクロスリファレンスし、
構造化されたテスト仕様書を自動生成する。3つの専用エージェントを順次起動するパイプライン。

---

## 実行手順

### Step 1: Truth Matrix 生成（Analyze）

`test-spec-analyzer` エージェント（subagent_type）を起動する。

**プロンプト:**
```
以下のスコープでTruth Matrixを生成してください。

スコープ: {$ARGUMENTS が指定されていれば $ARGUMENTS、なければ「全体」}

## 参照ファイル
- docs/phase0_plan.md（設計仕様）
- docs/api-design.md（API仕様）
- CLAUDE.md（アーキテクチャ原則）

## 実装コード
- src/domain/models/（ドメインモデル）
- src/domain/services/（ドメインサービス）
- src/application/commands/（Commandハンドラ）
- src/application/queries/（Queryハンドラ）
- src/app/api/（API Route Handlers）

エージェント定義の出力フォーマットに従い、Truth Matrixを返却してください。
```

**完了条件**: Truth Matrixがレスポンスとして返却される。

---

### Step 2: テスト仕様書生成（Generate）

`test-spec-writer` エージェント（subagent_type）を起動する。
Step 1 の Truth Matrix をプロンプトに含める。

**プロンプト:**
```
以下のTruth Matrixに基づいてテスト仕様書を生成してください。

スコープ: {$ARGUMENTS が指定されていれば $ARGUMENTS、なければ「全体」}

## Truth Matrix
{Step 1で取得したTruth Matrix全文をここに貼り付ける}

## 出力先
docs/test-spec.md

## 既存テストファイルの確認
以下のテストファイルを検索し、実装状態を判定してください:
- src/domain/models/*.test.ts
- src/application/commands/*.test.ts
- src/application/queries/*.test.ts

エージェント定義の出力フォーマットに従い、テスト仕様書を生成してください。
```

**完了条件**: `docs/test-spec.md` が作成される。

---

### Step 3: 検証（Review）

`test-spec-reviewer` エージェント（subagent_type）を起動する。
Step 1 の Truth Matrix をプロンプトに含める。

**プロンプト:**
```
以下のテスト仕様書を検証してください。

## テスト仕様書
docs/test-spec.md を読み取ってください。

## Truth Matrix（検証基準）
{Step 1で取得したTruth Matrix全文をここに貼り付ける}

エージェント定義の検証項目と出力フォーマットに従い、検証レポートを返却してください。
```

**完了条件**: 検証レポートがレスポンスとして返却される。

---

### Step 4: 結果レポート

以下をチャットに出力する:

```
## テスト仕様書生成完了

### 生成結果
- スコープ: {$ARGUMENTS}
- 出力ファイル: docs/test-spec.md
- テストケース数: {Step 2の結果から抽出}

### 検証結果
- 総合判定: {PASS / PASS_WITH_WARNINGS / FAIL}
- カバレッジ: {XX%}
- 品質問題: {N件}

### 未カバー項目（あれば）
{Step 3の未カバー項目一覧}

### 次のアクション
- PASS: テスト仕様書は完成。テストコード実装に進めます。
- PASS_WITH_WARNINGS: 警告項目を確認し、必要に応じて修正してください。
- FAIL: Step 2を再実行するか、手動で修正が必要です。
```

---

## スコープ別の参照ガイド

| スコープ | phase0参照セクション | 主要実装ファイル |
|---------|-------------------|----------------|
| `issue` | §0.5 状態遷移, §0.8 写真 | issue.ts, update-issue-status.ts, add-photo.ts |
| `organization` | §0.3 組織, §0.13 | organization.ts, create-organization.ts, delete-organization.ts |
| `user` | §0.3 ユーザー | user.ts, create-user.ts, deactivate-user.ts |
| `auth` | §0.12 認可, API認可マトリクス | permission-service.ts, requireRole middleware |
| `api` | 全APIセクション | src/app/api/**/*.ts |
| `progress` | §0.7 進捗率, §0.9 Worker | list-projects.ts |
| `domain` | §0.3-§0.8 | src/domain/models/*.ts |
| `全体` | 全セクション | 全ファイル |

## 注意事項

- 各Stepは順次実行する（並行不可）。前Stepの出力が次Stepの入力となるため。
- Truth Matrixが大きい場合、Step 2/3のプロンプトが長くなるが、全文を含めること。
- Step 3でFAILの場合、未カバー項目のみを対象にStep 2を再実行することで効率的に補完できる。
- 既存の `docs/test-spec.md` がある場合は上書きされる。バックアップが必要なら事前に退避すること。
