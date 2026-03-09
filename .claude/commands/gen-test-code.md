# テストコード生成パイプライン

対象スコープ（省略可）: $ARGUMENTS

## このスキルの目的

テスト仕様書（`docs/test-spec.md`）に基づいて、Unit/Integration テストコード（Vitest）と
E2E テストコード（Playwright）を自動生成する。**生成のみ。実行・修正は行わない。**

**前提条件**: `docs/test-spec.md` が存在すること（`/gen-test-spec` で事前生成）

---

## 実行手順

### Step 1: 未実装テストケースの抽出

`docs/test-spec.md`（または `docs/test-specs/{scope}.md`）を読み取り、
「実装状態: 未実装」のテストケースを抽出する。

$ARGUMENTS が指定されている場合はそのスコープのテストケースのみ対象とする。

**抽出結果を以下に分類:**
- **Unit/Integration**: DOM-* / APP-* / API-* → Step 2 へ
- **E2E**: E2E-* → Step 3 へ

Unit/Integration テストケースが0件の場合は Step 2 をスキップ。
E2E テストケースが0件の場合は Step 3 をスキップ。

---

### Step 2: Unit/Integration テストコード生成

`unit-test-coder` エージェント（subagent_type）を起動する。

**プロンプト:**
```
以下の未実装テストケースに対して Vitest テストコードを生成してください。

## 対象テストケース
{Step 1 で抽出した DOM-* / APP-* / API-* テストケース一覧}

## テスト仕様書パス
docs/test-spec.md

## 既存テストファイル（重複防止のため確認すること）
- src/domain/models/*.test.ts
- src/application/commands/*.test.ts
- src/application/queries/*.test.ts
- src/app/api/**/*.test.ts

エージェント定義のパターンに従い、テストコードを生成してください。
```

---

### Step 3: E2E テストコード生成

`e2e-test-coder` エージェント（subagent_type）を起動する。
**Step 2 と並行実行可能。**

**プロンプト:**
```
以下の未実装テストケースに対して Playwright テストコードを生成してください。

## 対象テストケース
{Step 1 で抽出した E2E-* テストケース一覧}

## テスト仕様書パス
docs/test-spec.md

## 既存E2Eテストファイル（重複防止のため確認すること）
- e2e/*.spec.ts

## フィクスチャ・ヘルパー
- e2e/fixtures/auth.ts（ロール別認証フィクスチャ）
- e2e/fixtures/test-data.ts（SEED定数）

エージェント定義のパターンに従い、テストコードを生成してください。
```

---

### Step 4: 結果レポート

以下をチャットに出力する:

```
## テストコード生成完了

### 生成結果
- スコープ: {$ARGUMENTS}
- Unit/Integration テスト: N件生成
- E2E テスト: M件生成

### 生成ファイル
| ファイル | 操作 | テストケース数 |
|---------|------|-------------|
| (生成されたファイル一覧) |

### 次のアクション
`/run-test` でテストを実行してください。
```

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
| `全体` | 全Unit/Integration | 全E2E |

## 注意事項

- Step 2 と Step 3 は並行実行可能（依存関係なし）
- テスト仕様書が存在しない場合は `/gen-test-spec` を先に実行するよう案内すること
- 既存テストとの重複を避けるため、既存ファイルの Read は必須
- **テストの実行・修正は行わない。** `/run-test` に委譲する
