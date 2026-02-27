# Application Layer

このディレクトリ（`src/application`）は、Clean Architectureにおける**ユースケース層（Application Business Rules）**に相当します。
システムが提供するアプリケーション固有のユースケース（機能）を実現するためのロジックを配置します。

## CQRS的思考（Command and Query Responsibility Segregation）

本プロジェクトでは、アプリケーション機能のアーキテクチャとしてCQRS（コマンド・クエリ責務分離）のアプローチを採用しており、ディレクトリ構造にもこの意図を反映しています。

### 1. Commands (更新系ユースケース)
- システムの状態を変更する操作（作成、更新、削除）を扱います。
- ドメイン層のエンティティを Repository 経由で取得または作成し、エンティティのメソッド（ビジネスロジック）を呼び出して状態を変更し、再度 Repository 経由で保存します。
- 例: `CreateIssueUseCase`、`UpdateIssueStatusUseCase`

### 2. Queries (参照系ユースケース)
- システムの状態を変更せず、データのみを取得して呼び出し元（プレゼンテーション層）にそのまま返す操作を扱います。
- パフォーマンスとシンプルさを重視し、ドメインエンティティを生成することなく、ORM（Prisma）等を使ってDTO（Data Transfer Object）として直接データを読み出します。
- 例: `GetIssuesQueryService`、`GetProjectsQueryService`

## 設計制約
- **依存の方向**: アプリケーション層は `src/domain` に関するレイヤーに依存します。`src/infrastructure` の実装クラスを直接 import するのではなく、依存性の注入（DI）などを用いてインターフェースに依存します（※ 参照系は一部例外としてインフラ実装に直接依存を許可する場合があります）。
- **トランザクション制御**: コマンドの実行時におけるトランザクションの境界は原則としてユースケース層で定義します。
