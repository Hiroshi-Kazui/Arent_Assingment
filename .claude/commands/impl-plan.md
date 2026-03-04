# 実装ギャップ分析 + PMエージェントプロンプト生成

対象スコープ（省略可）: $ARGUMENTS

## このスキルの目的

`phase0_plan.md`（設計仕様）と現在のコードベースを比較し、
**未実装・不完全な箇所を特定**して実装計画を作成する。
フェーズ番号ではなく「何が足りないか」を起点にする。

---

## 実行手順

### Step 1: 設計仕様の読み取り

`doc/phase0_plan.md` から以下を抽出する:

1. **ドメインモデル一覧**（エンティティ・集約・Value Object・状態遷移・権限ルール）
2. **DBスキーマ仕様**（テーブル・カラム・制約）
3. **APIエンドポイント一覧**（メソッド・パス・権限・入出力）
4. **UI画面一覧**（画面ID・役割・ロール別表示差異）
5. **アーキテクチャ制約**（レイヤー分離・CQRS・依存方向）

---

### Step 2: 現在の実装状態の調査

以下をGlob/Grepで調査し、実装済みファイルと内容を把握する:

```
src/domain/models/          — Domainモデル（集約・VO）
src/domain/repositories/    — Repositoryインターフェース
src/domain/errors/          — ドメインエラー
src/application/commands/   — Commandハンドラ
src/application/queries/    — Queryハンドラ
src/application/dto/        — DTO
src/infrastructure/prisma/  — Prisma Repository実装
src/infrastructure/minio/   — MinIO Storage実装
src/infrastructure/aps/     — APS Token実装
src/infrastructure/auth/    — 認証実装
src/app/api/                — API Route Handler
src/app/ (pages/components) — UI
prisma/schema.prisma        — DBスキーマ
```

**調査観点：**
- ファイルが存在するか
- 実装が空・スタブ・TODOコメントを含んでいないか
- 設計仕様のフィールド・メソッドが揃っているか（必要に応じてファイルを部分的に読む）

---

### Step 3: ギャップ分析

Step 1と Step 2を比較し、以下の表を作成する:

| カテゴリ | 設計仕様 | 実装状態 | ギャップ内容 |
|---------|---------|---------|------------|
| Domain  | Issue.changeStatus() | 実装済み | なし |
| API     | PATCH /assignee | 未実装 | ルートハンドラが存在しない |
| UI      | 画面E: 履歴タブ | スタブ | StatusChangeLog非表示 |
| ...     | ...      | ...     | ... |

**ギャップの優先度付け:**
- 🔴 Critical: 他の実装がブロックされる（Domain・DB・Infrastructure）
- 🟡 Important: ユーザーが価値を得るために必要（API・Application）
- 🟢 Nice-to-have: UX向上・ドキュメント（UI細部・docs）

$ARGUMENTS が指定されている場合はそのスコープのみ対象とする。

---

### Step 4: 実装計画ファイルの作成

**ファイルパス:** `C:\Users\prove\.claude\plans\impl-plan-{YYYYMMDD-HHmm}.md`
（タイムスタンプ付きで上書きを防ぐ。例: `impl-plan-20260305-1430.md`）

**計画書の構成:**

```
# 実装ギャップ計画書（{作成日時}）

## ギャップサマリー
- 🔴 Critical: N件
- 🟡 Important: N件
- 🟢 Nice-to-have: N件

## 現在の実装状態（調査結果）
（Step 2で把握した実装済み内容を箇条書きで記述）

## 未実装・不完全な箇所（ギャップ一覧）
（Step 3の表をそのまま記載）

## 実装計画

### フェーズ1: Critical ギャップの解消（並行不可部分）
（Domainモデル・DBスキーマ変更など、他の作業の前提となるもの）

変更ファイル:
- ...

### フェーズ2: Important ギャップの解消（並行実行可能）

#### グループ A（Infrastructure + Application）
変更ファイル:
- ...

#### グループ B（API Routes）
変更ファイル:
- ...

### フェーズ3: UI + Nice-to-have

変更ファイル:
- ...

## エージェントチームへの作業分割指示

利用可能なエージェント（`subagent_type` の値）:
- `domain-architect` — `src/domain/` 専任。集約・VO・Repositoryインターフェース・ドメインエラー
- `infrastructure-engineer` — `src/infrastructure/`・`prisma/`・`docker-compose.yml` 専任
- `application-engineer` — `src/application/` 専任。Command/Queryハンドラ・DTO
- `frontend-engineer` — `src/app/` 専任。API Route Handlers・pages・components・APS Viewer
- `doc-writer` — `docs/`・`README.md` 専任。設計ドキュメント・Mermaidダイアグラム

### domain-architect（Domain層）— 最初に実行
タスク:
（フェーズ1のDomain変更を具体的に指示。参照すべきファイルを明記）

domain-architectが完了したら、infrastructure-engineer と application-engineer を並行実行可能。

### infrastructure-engineer（DB / Infrastructure層）— domain-architect完了後
タスク:
（フェーズ1のPrismaスキーマ変更・Infrastructure実装を指示）

### application-engineer（Application層）— domain-architect完了後（infrastructure-engineerと並行）
タスク:
（フェーズ2 グループAのApplicationレイヤーを担当。DTOの型はDomain層の定義を参照）

application-engineer と infrastructure-engineer が完了したら、frontend-engineer を実行可能。

### frontend-engineer（API Routes + UI）— application-engineer + infrastructure-engineer完了後
タスク:
（フェーズ2のAPI Route Handlers + フェーズ3のUI実装をまとめて担当）

### doc-writer（ドキュメント）— frontend-engineer完了後（任意）
タスク:
（docs/architecture.md・docs/api-design.md・README.mdの更新。ギャップ解消による変更点を反映）

## アーキテクチャ制約（エージェントへの共通指示）
- `src/domain/` 配下は PrismaClient / next-auth / MinIO を一切importしない
- Command はDomain集約を経由する。Query はDB直接読み取り（CQRS）
- Infrastructure層がDomain層のinterfaceを実装する（依存性逆転）
- TypeScript strict mode: any 型禁止
- DBマイグレーション名: `add-xxx` / `change-xxx` の命名規則に従う

## 動作確認手順
（ギャップが解消されたことを確認するためのステップを記述）
1. ...
2. ...

## 参照ファイル一覧
| ファイル | 操作 |
|---------|------|
| ... | 新規作成 / 変更 / 参照のみ |
```

---

### Step 5: PMエージェント投げ込みプロンプトの出力

計画書ファイルを作成したら、以下の形式でそのままコピペできるプロンプトをチャット上に出力する:

---

```
以下の計画書に基づいてタスクを実行してください。

計画書: C:\Users\prove\.claude\plans\impl-plan-{YYYYMMDD-HHmm}.md
作業ディレクトリ: c:\develop\Arent\Assignment

計画書内の「エージェントチームへの作業分割指示」に従い、
TeamCreate でチームを作成し、サブエージェントに作業を並行委譲してください。

【実行順序】
1. domain-architect（Domain層）
2. infrastructure-engineer + application-engineer（並行）
3. frontend-engineer（API Routes + UI）
4. doc-writer（ドキュメント更新、任意）

各サブエージェントの subagent_type は計画書に記載のエージェント名をそのまま使用すること。
実行中は確認ダイアログを出さず、すべて自動で進めてください。
サブエージェントも bypassPermissions モードで起動してください。

【完了レビュー基準】
（計画書の「動作確認手順」を箇条書きで列挙）
```

---

## 注意事項

- ギャップがゼロの場合は「実装完了。未対応項目なし」と報告し、計画書は作成しない
- $ARGUMENTS でスコープを絞れる（例: `domain`, `api`, `ui`）
- ギャップが多い場合、1回のエージェントチームで全部を実行しようとせず、Criticalのみを先に計画書に含める（スコープを絞る）
- 計画書はエージェントが迷わず実行できる粒度に保つ。参照すべきファイルは具体的なパスで明記する
