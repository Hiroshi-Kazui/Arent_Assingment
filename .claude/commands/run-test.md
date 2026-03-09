# テスト実行パイプライン

対象スコープ（省略可）: $ARGUMENTS

## このスキルの目的

テストを実行し、結果をレポートする。**読み取り専用。コードの修正は一切行わない。**
失敗の原因がテストコード側かプロダクションコード側かを人間が判断するための情報を提供する。

---

## 実行手順

### Step 1: テスト対象ファイルの特定

$ARGUMENTS が指定されている場合:
- スコープに対応するテストファイルのみ対象とする（下記対応表参照）

$ARGUMENTS が未指定の場合:
- 全テストファイルを対象とする

**分類:**
- **Unit/Integration**: `src/**/*.test.ts` → Step 2 へ
- **E2E**: `e2e/*.spec.ts` → Step 3 へ

---

### Step 2: Unit/Integration テスト実行

以下のコマンドを実行する:

```bash
npx vitest run {対象ファイルパス} --reporter=verbose 2>&1
```

$ARGUMENTS が未指定の場合:
```bash
npx vitest run --reporter=verbose 2>&1
```

**結果を記録する（修正は行わない）。**

---

### Step 3: E2E テスト実行

以下のコマンドを実行する:

```bash
npx playwright test {対象ファイルパス} --reporter=list 2>&1
```

$ARGUMENTS が未指定の場合:
```bash
npx playwright test --reporter=list 2>&1
```

**結果を記録する（修正は行わない）。**

**注意**: E2E テストの実行には Docker（PostgreSQL + MinIO）と dev server が起動している必要がある。
起動していない場合はその旨をレポートに記載し、スキップする。

---

### Step 4: 結果レポート

以下をチャットに出力する:

```
## テスト実行結果

### サマリ
- スコープ: {$ARGUMENTS または「全体」}
- Unit/Integration: XX passed / YY failed / ZZ total
- E2E: XX passed / YY failed / ZZ total

### 失敗テスト一覧（あれば）
| テストファイル | テスト名 | エラー概要 | 推定原因 |
|--------------|---------|-----------|---------|
| (失敗テストの詳細) |

推定原因は以下のいずれかで分類:
- **テストコード**: モック不足、アサーション誤り、非同期タイミング等
- **プロダクションコード**: ロジックバグ、未実装機能、型不整合等
- **環境**: Docker未起動、DB接続エラー、依存パッケージ不足等

### 次のアクション
- 全テスト合格: 完了
- テストコード側の問題: `/fix-test` を実行
- プロダクションコード側の問題: `/fix-prod` を実行
- 環境問題: 環境を修正後、`/run-test` を再実行
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
| `unit` | `src/**/*.test.ts`（全ファイル） | - |
| `全体` | 全Unit/Integration | 全E2E |

## 注意事項

- **コードの修正は一切行わない。** 結果レポートのみ出力する
- 推定原因の分類は参考情報であり、最終判断は人間が行う
- E2E テスト実行前に Docker と dev server の起動状態を確認すること
