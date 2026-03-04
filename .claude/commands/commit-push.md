# commit & push

未コミットの変更を論理的なグループに分割し、適切なコミットメッセージを付けてコミット＆プッシュする。

## 実行手順

以下のステップを順番に実行してください。

---

### Step 1: 変更内容の把握

1. `git status` で未コミットファイルを確認する
2. `git diff HEAD` で変更内容を確認する
3. `git log --oneline -10` で既存のコミットメッセージスタイルを確認する

---

### Step 2: 変更をグループに分類する

以下の観点でファイルをグループ化する:

| グループ | 対象パス | prefixの例 |
|---------|---------|-----------|
| Domain層 | `src/domain/` | `feat(domain):` / `fix(domain):` |
| Application層 | `src/application/` | `feat(application):` / `fix(application):` |
| Infrastructure層 | `src/infrastructure/`, `prisma/` | `feat(infra):` / `fix(infra):` |
| API / UI | `src/app/` | `feat(api):` / `feat(ui):` / `fix(api):` |
| ドキュメント | `doc/`, `README.md` | `docs:` |
| 設定 | `.env.example`, `docker-compose.yml`, `*.config.*` | `chore:` |
| テスト | `**/*.test.*`, `**/*.spec.*` | `test:` |

- 同一機能に関連する複数層の変更は1コミットにまとめてよい
- 無関係な変更は必ず別コミットにする

---

### Step 3: コミットメッセージを決定する

各グループのコミットメッセージは以下のルールに従う:

- **Conventional Commits** 形式: `type(scope): 説明`
- 説明は「何をしたか」ではなく「なぜ・何のためか」を書く
- `git log` の言語（日本語/英語）に合わせる
- 必ず末尾に付与: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- HEREDOC形式でコミットメッセージを渡す

---

### Step 4: グループ順にステージ → コミットを実行する

依存関係のある順（Domain → Infra → Application → UI → Docs）でコミットする。
各コミット後に成功を確認してから次へ進む。

---

### Step 5: プッシュする

```
git push origin <現在のブランチ名>
```

---

### Step 6: 完了報告

- 作成したコミット一覧（hash + メッセージ）をまとめて報告する
- 除外したファイルがある場合はその理由も報告する

---

## 安全ルール

- `.env` / 秘密情報を含むファイルは絶対にコミットしない
- `--force` push は絶対に使わない
- 既存コミットを `--amend` しない
- 不明なファイルはスキップしてユーザーに報告する
