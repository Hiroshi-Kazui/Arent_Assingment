# テスト仕様書生成パイプライン

対象スコープ（省略可）: $ARGUMENTS

## このスキルの目的

設計仕様（phase0_plan.md, api-design.md）と実装コードをクロスリファレンスし、
構造化されたテスト仕様書を自動生成する。reviewerがPASSを返すまでwriter→reviewerをループする。

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

### Step 2-3 ループ: 生成→検証→修正（最大3回）

以下の Step 2（Generate）と Step 3（Review）を **最大3回** 繰り返す。
ループ終了条件: Step 3 の総合判定が **PASS** であること。

#### ループ変数
- `iteration`: 現在のループ回数（1, 2, 3）
- `previousReviewReport`: 前回のStep 3検証レポート（初回はなし）

---

#### Step 2: テスト仕様書生成（Generate）

`test-spec-writer` エージェント（subagent_type）を起動する。
Step 1 の Truth Matrix をプロンプトに含める。
**2回目以降は、前回のStep 3検証レポートも含める。**

**プロンプト（初回 iteration=1）:**
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

## 品質要件（reviewerの判定基準）
以下の基準を満たすテスト仕様書を生成すること:
1. Truth Matrix全項目に対するカバレッジ90%以上
2. 全テストケースにIDが付与され、{Layer}-{Feature}-{NNN} 形式に準拠
3. 前提条件が具体的（「存在する」だけでなくファクトリメソッド呼び出し等を明示）
4. 操作欄にimport文やメソッドの完全な呼び出し形式を記述
5. 各権限テストについて「許可ケース（正常系）」と「拒否ケース（異常系）」の両方を定義
6. CONFLICT/MISSING_SPEC項目は実装準拠でテストを定義し、備考に矛盾内容を明記

エージェント定義の出力フォーマットに従い、テスト仕様書を生成してください。
```

**プロンプト（2回目以降 iteration>=2）:**
```
前回のテスト仕様書に対するレビュー指摘を修正してください。

スコープ: {$ARGUMENTS が指定されていれば $ARGUMENTS、なければ「全体」}

## Truth Matrix
{Step 1で取得したTruth Matrix全文をここに貼り付ける}

## 前回のレビュー指摘（iteration={iteration}回目の修正）
{previousReviewReport の全文をここに貼り付ける}

## 修正対象ファイル
docs/test-spec.md（既存ファイルを読み取り、指摘箇所を修正してください）

## 修正指示
1. 「未カバー項目一覧」に挙げられたTruth Matrix項目に対応するテストケースを追加する
2. 「品質問題一覧」に挙げられたテストケースの前提条件・操作・期待結果を修正する
3. 「権限テスト網羅性」で不足と指摘された許可/拒否ケースを追加する
4. サマリーのテストケース数を更新する
5. 付録の対応一覧を更新する
6. 指摘のない既存テストケースは変更しないこと

エージェント定義の出力フォーマットに従い、修正済みテスト仕様書を出力してください。
```

**完了条件**: `docs/test-spec.md` が作成または更新される。

---

#### Step 3: 検証（Review）

`test-spec-reviewer` エージェント（subagent_type）を起動する。
Step 1 の Truth Matrix をプロンプトに含める。

**プロンプト:**
```
以下のテスト仕様書を検証してください。

## テスト仕様書
docs/test-spec.md を読み取ってください。

## Truth Matrix（検証基準）
{Step 1で取得したTruth Matrix全文をここに貼り付ける}

## 検証観点
以下の全項目を検証し、総合判定を返却してください:

### PASS条件（すべて満たす必要がある）
1. カバレッジ: Truth Matrix全項目の90%以上がテストケースでカバーされている
2. ID一意性: テストケースIDに重複がない
3. 品質: 前提条件・操作・期待結果が具体的かつ検証可能である
4. 権限テスト: 主要機能について許可ケース（正常系）と拒否ケース（異常系）の両方が存在する
5. 実装ファイル: 参照される実装ファイルがすべて存在する

### PASS_WITH_WARNINGS条件
- PASS条件の1〜5を満たすが、軽微な改善点がある（命名規則の不統一、E2Eテストの実装ファイル参照なし等）

### FAIL条件（1つでも該当すればFAIL）
- カバレッジ90%未満
- 重大な品質問題（期待結果が検証不可能、前提条件が欠落等）が3件以上
- 権限テストで許可ケースまたは拒否ケースが体系的に欠如

エージェント定義の検証項目と出力フォーマットに従い、検証レポートを返却してください。
総合判定は必ず PASS / PASS_WITH_WARNINGS / FAIL のいずれかを明記してください。
```

**完了条件**: 検証レポートがレスポンスとして返却される。

---

#### ループ判定

Step 3 の検証レポートから総合判定を抽出し、以下のルールで判定する:

- **PASS**: ループ終了 → Step 4へ
- **PASS_WITH_WARNINGS**: ループ終了 → Step 4へ
- **FAIL**:
  - iteration < 3 の場合: `previousReviewReport` に検証レポートを保存し、iteration++ で Step 2 へ戻る
  - iteration = 3 の場合: ループ終了 → Step 4へ（最終結果として FAIL を報告）

---

### Step 4: 結果レポート

以下をチャットに出力する:

```
## テスト仕様書生成完了

### 生成結果
- スコープ: {$ARGUMENTS}
- 出力ファイル: docs/test-spec.md
- テストケース数: {最終Step 2の結果から抽出}
- ループ回数: {iteration}回

### 検証結果
- 総合判定: {PASS / PASS_WITH_WARNINGS / FAIL}
- カバレッジ: {XX%}
- 品質問題: {N件}

### 未カバー項目（あれば）
{最終Step 3の未カバー項目一覧}

### 警告事項（あれば）
{最終Step 3の警告一覧}

### 次のアクション
- PASS: テスト仕様書は完成。`/gen-test-code` でテストコード実装に進めます。
- PASS_WITH_WARNINGS: 警告項目を確認してください。テストコード生成は可能です。
- FAIL（3回ループ後）: 手動修正が必要です。最終レビューの指摘事項を参照してください。
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

- Step 1は1回のみ実行。Step 2-3がループする。
- Truth Matrixが大きい場合、Step 2/3のプロンプトが長くなるが、全文を含めること。
- 2回目以降のStep 2では、docs/test-spec.mdの既存内容を読み取って修正する（全体再生成ではなく差分修正）。
- 既存の `docs/test-spec.md` がある場合は上書きされる。バックアップが必要なら事前に退避すること。
- ループ最大3回の制限は、無限ループ防止のため。3回で収束しない場合は設計上の問題がある可能性が高い。
