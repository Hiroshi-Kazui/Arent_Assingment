# Presentation Layer (App)

このディレクトリ（`src/app` および `src/components`）は、Clean Architectureにおける**プレゼンテーション層（UI & Controllers）**に相当します。

## 主な構成要素

- **src/app (Route Handlers / API)**:
  - Next.js の App Router によって定義される API ルートです。
  - 外部（クライアント）から受け取ったHTTPリクエストをパース、バリデーションし、`src/application` 層の ユースケース（Command / Query）へとルーティング（委譲）します。コントローラーとしての役割を担います。
- **src/app (Pages) / src/components**:
  - Next.js の React コンポーネント群です。UIの描画や、状態管理（React Hooks等）を担当します。
  - Shadcn UI (Tailwind CSS, Radix UI) を活用して、Modern & Stylish なビューを提供します。

## 設計制約
- **依存の方向**: プレゼンテーション層は `src/application` などのユースケース層に依存します。原則として `src/domain` 層のオブジェクト（エンティティとしてのメソッド）を直接操作することは避け、ユースケースを経由させます。
- **ビジネスロジックの排除**: Reactコンポーネント内やAPIルート内に複雑なビジネスルールや計算処理を記述してはいけません。そのようなロジックはドメイン層やアプリケーション層に移動させます。
