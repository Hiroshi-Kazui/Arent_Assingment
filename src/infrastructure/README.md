# Infrastructure Layer

このディレクトリ（`src/infrastructure`）は、Clean Architectureにおける**インフラストラクチャ層（Frameworks and Drivers）**に相当します。
データベース、外部API、ファイルシステムなどの外部リソースや技術的詳細と連携するための実装・アダプターが配置されます。

## 主な構成要素

- **Repositories (実装)**:
  - `src/domain` で定義された Repository インターフェースの具体的な実装クラスです。
  - Prisma を用いたデータベースアクセスや、MinIO（S3互換）とのファイル連携ロジックなどを記述します。
  - 取得したDBデータからドメインエンティティへの復元（再構築）も行います。
- **Query Services (実装)**:
  - `src/application` のクエリ（Query）実装を提供します。DTOとしてデータを直接取得し、フロントエンドに返しやすい形へと整形します。
- **External Services**:
  - APS（Autodesk Platform Services）Viewerの認証やデータ取得など、外部APIの通信ロジックを配置します。
  
## 設計制約
- **依存の方向**: インフラストラクチャ層は、最も外側に位置します。`src/domain` および `src/application` で定義されたインターフェースを実装する形で、内側の層に依存します。
- **技術詳細のカプセル化**: DBのマイグレーションツールやAWS SDK等のライブラリを直接扱うのはこの層のみであり、内側の層へ技術詳細が漏出しないようにします。
