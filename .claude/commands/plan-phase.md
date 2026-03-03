# フェーズ計画書作成 + PMエージェントプロンプト生成

対象フェーズ: $ARGUMENTS

## 実行手順

以下のステップを順番に実行してください。

---

### Step 1: プロジェクト現状の把握

以下のファイルを調査して現在の実装状態を把握する:

1. `doc/phase0_plan.md` を読み、フェーズ番号に対応する要件・スコープを抽出する
2. `prisma/schema.prisma` で現在のDBスキーマを確認する
3. 以下のディレクトリをGlob/Grepで調査し、実装済みファイルを列挙する:
   - `src/domain/models/` — Domain モデル
   - `src/domain/repositories/` — Repository インターフェース
   - `src/application/commands/` — Command ハンドラ
   - `src/application/queries/` — Query ハンドラ
   - `src/application/dto/` — DTO
   - `src/infrastructure/prisma/` — Prisma リポジトリ実装
   - `src/infrastructure/auth/` — 認証関連
   - `src/app/api/` — API Route ハンドラ
   - `src/app/` （pages/components） — UI
4. `C:\Users\prove\.claude\plans\` 配下の既存計画書ファイルを読み、前フェーズの完了状態を把握する

---

### Step 2: 計画書ファイルの作成

以下の構成で計画書ファイルを新規作成する:

**ファイルパス:** `C:\Users\prove\.claude\plans\phase-{N}-plan.md`
（N は対象フェーズ番号。例: Phase 4 なら `phase-4-plan.md`）

**計画書の構成（必ずこの順序で記述）:**

```
# Phase {N}: {タイトル} 実装計画書

## 前提：前フェーズ完了後の状態
- 実装済みドメインモデル一覧
- 実装済みスキーマ（テーブル/カラム）
- 実装済みAPIエンドポイント

## Phase {N} の実装スコープ

### 1. Domain層の変更
（新規モデル・インターフェース・メソッドを詳述）

### 2. DBスキーマの変更
（追加テーブル/カラム。Prismaスキーマのコード例を含める）
（変更不要な場合は「変更なし」と明記）

### 3. Infrastructure層の変更
（新規 or 変更する具象リポジトリ・実装）

### 4. Application層の変更
（DTO変更・Command Handler・Query の追加/変更）

### 5. APIエンドポイントの変更
（新規 or 変更するルートハンドラ。HTTPメソッド/パス/Body/Responseを明記）

### 6. UIの変更
（新規ページ・コンポーネント・既存コンポーネントの変更）

## エージェントチームへの作業分割指示

### Agent A（{担当領域}）— 最初に実行
タスク:
1. ...

Agent Aが完了したら、Agent B と Agent C を並行実行可能。

### Agent B（{担当領域}）— Agent A完了後
タスク:
1. ...

### Agent C（{担当領域}）— Agent A完了後（Bと並行）
タスク:
1. ...

### Agent D（UI）— Agent B + Agent C完了後
タスク:
1. ...

## 重要な制約・注意事項

### アーキテクチャ制約（必ず守ること）
- `src/domain/` 配下のファイルは PrismaClient, next-auth, MinIO等を一切importしない
- CQRS: Command はDomain集約経由、Query はDB直接読み取り
- Infrastructure層がDomain層のinterfaceを実装する（依存性逆転）

### 既存機能を壊さないこと
（既存APIエンドポイント・機能で注意が必要なものを列挙）

### TypeScript strict mode
- any 型の使用禁止
（その他型に関する注意事項）

## 動作確認手順
1. ...
2. ...

## 参照ファイル一覧

| ファイル | 操作 |
|---------|------|
| ... | 新規作成 |
| ... | 変更 |
```

---

### Step 3: PMエージェント投げ込みプロンプトの出力

計画書ファイルを作成したら、以下の形式でそのままコピペできるプロンプトをチャット上に出力する:

---

```
以下の計画書に基づいてタスクを実行してください。

計画書: C:\Users\prove\.claude\plans\phase-{N}-plan.md
作業ディレクトリ: c:\develop\Arent\Assignment

計画書内の「エージェントチームへの作業分割指示」に従い、
TeamCreate でチームを作成し、サブエージェントに作業を並行委譲してください。

Agent A → (Agent B + Agent C 並行) → Agent D の順序を守ること。
実行中は確認ダイアログを出さず、すべて自動で進めてください。
サブエージェントも bypassPermissions モードで起動してください。

【完了レビュー基準】
（計画書の「動作確認手順」を箇条書きで列挙）
```

---

## 注意事項

- Phase番号とタイトルが引数に含まれていない場合は、`doc/phase0_plan.md` の実装フェーズ計画から次に実装すべきフェーズを推定して提案する
- 計画書は詳細すぎず、エージェントが迷わず実装できる粒度に保つ
- 既存機能との依存関係・型変更の波及範囲は必ず記述する
- DBマイグレーションが必要な場合は、マイグレーション名の命名規則（`add-xxx`, `change-xxx`）に従う
