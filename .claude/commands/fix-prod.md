# プロダクションコード修正パイプライン

対象スコープ（省略可）: $ARGUMENTS

## このスキルの目的

テスト失敗の原因がプロダクションコード側にある場合に、該当コードを修正し再テストで検証する。
**プロダクションコードのみ修正する。テストコードは一切変更しない。**

**前提条件**: `/run-test` の結果で失敗がプロダクションコード側の問題と判断されていること。

---

## 実行手順

### Step 1: 失敗テストの特定と原因分析

$ARGUMENTS が指定されている場合:
- スコープに対応するテストファイルのみ対象とする

$ARGUMENTS が未指定の場合:
- 全テストファイルを対象に、まず実行して失敗テストを特定する

```bash
npx vitest run --reporter=verbose 2>&1
npx playwright test --reporter=list 2>&1
```

失敗テストがない場合はレポートを出力して終了する。

失敗テストのエラー内容から、修正対象のプロダクションコードファイルを特定する。

---

### Step 2: 修正→再テストループ（最大3回、引数で変更可）

失敗原因の所在レイヤーに応じて適切なエージェントを起動する。

$ARGUMENTS に数値が含まれる場合（例: `issue 5`）、その数値を最大ループ回数とする。
数値がない場合はデフォルト3回。

**レイヤー別エージェント選定:**
| 修正対象 | エージェント（subagent_type） |
|---------|---------------------------|
| `src/domain/` | `domain-architect` |
| `src/application/` | `application-engineer` |
| `src/infrastructure/` | `infrastructure-engineer` |
| `src/app/` | `frontend-engineer` |
| 複数レイヤーにまたがる | `reviewer` で分析後、各レイヤーのエージェントを順次起動 |

**プロンプト（各エージェント共通テンプレート）:**
```
以下のテスト失敗を解消するために、プロダクションコードを修正してください。

## 失敗テスト一覧
{Step 1 で特定した失敗テストのファイルパス、テスト名、エラー出力}

## 修正対象ファイル（推定）
{エラー内容から特定したプロダクションコードのファイルパス}

## 制約
- **プロダクションコードのみ修正可能**
- テストコード（*.test.ts, *.spec.ts）は変更禁止
- CLAUDE.md のアーキテクチャ原則（依存方向、CQRS等）を遵守すること
- Domain層は他の層に依存しないこと

## 参照仕様
- docs/phase0_plan.md（設計仕様）
- docs/api-design.md（API仕様）
- CLAUDE.md（アーキテクチャ原則）

修正後に以下のコマンドで再テストを実行し、成否を確認してください:
- Unit/Integration: npx vitest run {関連テストファイル}
- E2E: npx playwright test {関連テストファイル}
```

**ループ制御:**
- 修正後に再テストを実行
- 全テスト合格: ループ終了
- 失敗が残る: 次のループへ
- 最大回数到達: 未解決として報告

---

### Step 3: 結果レポート

以下をチャットに出力する:

```
## プロダクションコード修正結果

### サマリ
- スコープ: {$ARGUMENTS または「全体」}
- 修正ループ: {実行回数} / {最大回数}
- 修正前: XX failed
- 修正後: YY failed（ZZ resolved）

### 修正内容
| ファイル | レイヤー | 修正内容 | 結果 |
|---------|---------|---------|------|
| (修正されたプロダクションファイル一覧) |

### 未解決の失敗（あれば）
| テストファイル | テスト名 | エラー概要 | 未解決理由 |
|--------------|---------|-----------|-----------|
| (最大ループ後も残った失敗) |

### 次のアクション
- 全テスト合格: 完了
- 未解決あり: 手動修正が必要、または仕様の見直しを検討
```

---

## スコープ別の修正対象ガイド

| スコープ | 主要プロダクションファイル | レイヤー |
|---------|------------------------|---------|
| `issue` | issue.ts, update-issue-status.ts, create-issue.ts | Domain, Application |
| `organization` | organization.ts, create-organization.ts, delete-organization.ts | Domain, Application |
| `user` | user.ts, create-user.ts, deactivate-user.ts | Domain, Application |
| `auth` | permission-service.ts, requireRole middleware | Domain, Application |
| `api` | src/app/api/**/*.ts | Presentation |
| `progress` | list-projects.ts | Application |
| `domain` | src/domain/models/*.ts | Domain |

## 注意事項

- **テストコードは一切変更しない**
- 修正対象は `src/` 配下のプロダクションコードのみ
- ループ回数のデフォルトは3回、引数で変更可能（例: `/fix-prod 5`）
- 複数レイヤーにまたがる修正の場合、依存方向（Domain ← Infrastructure）を厳守
- E2E テストの再実行には Docker と dev server が必要
