# テスト仕様書 - 指摘管理ツール

| 項目 | 内容 |
|------|------|
| プロジェクト | Arent 指摘管理ツール |
| 作成日 | 2026-03-09 |
| バージョン | 1.0 |

---

## 目次

1. [テスト方針](#1-テスト方針)
2. [ドメイン層テスト](#2-ドメイン層テスト)
3. [アプリケーション層テスト（Command）](#3-アプリケーション層テストcommand)
4. [アプリケーション層テスト（Query）](#4-アプリケーション層テストquery)
5. [API統合テスト](#5-api統合テスト)
6. [インフラ層テスト](#6-インフラ層テスト)
7. [E2Eシナリオテスト](#7-e2eシナリオテスト)

---

## 1. テスト方針

### 1.1 テストピラミッド

| レベル | 対象 | ツール | 割合 |
|--------|------|--------|------|
| Unit | Domain models, Value Objects | Vitest | 60% |
| Integration | Command/Query handlers, Repositories | Vitest + TestDB | 25% |
| API | Route handlers (HTTP層) | Vitest + supertest | 10% |
| E2E | ユーザーシナリオ全体 | Playwright | 5% |

### 1.2 テストID規約

```
{層}-{機能}-{連番}
例: DOM-ISS-001 = Domain層 / Issue / テストケース001
```

### 1.3 優先度

| 記号 | 意味 |
|------|------|
| **P0** | 必須（ビジネスルール・状態遷移） |
| **P1** | 重要（バリデーション・認可） |
| **P2** | 通常（正常系・CRUD） |
| **P3** | 低（境界値・エッジケース） |

---

## 2. ドメイン層テスト

### 2.1 Issue 集約ルート

#### 2.1.1 生成

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| DOM-ISS-001 | assigneeなしで生成 | なし | title, description, dueDate, location, reportedBy | status=POINT_OUT, assigneeId=undefined | P0 |
| DOM-ISS-002 | assigneeありで生成 | なし | 上記+assigneeId | status=OPEN, assigneeId設定済 | P0 |
| DOM-ISS-003 | タイトル空文字で生成 | なし | title="" | DomainError throw | P1 |
| DOM-ISS-004 | 説明空文字で生成 | なし | description="" | DomainError throw | P1 |
| DOM-ISS-005 | 不正な日付で生成 | なし | dueDate=InvalidDate | DomainError throw | P1 |
| DOM-ISS-006 | 優先度デフォルト | なし | priority未指定 | priority=Medium | P2 |
| DOM-ISS-007 | issueType指定 | なし | issueType=Quality | issueType=Quality | P2 |
| DOM-ISS-008 | reconstruct | DB復元 | 全プロパティ | 同一プロパティのIssueインスタンス | P2 |

#### 2.1.2 状態遷移（正常系）

| ID | テストケース | 前提条件 | 操作 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| DOM-ISS-010 | OPEN → IN_PROGRESS | status=OPEN | startWork() | status=IN_PROGRESS | P0 |
| DOM-ISS-011 | IN_PROGRESS → DONE | status=IN_PROGRESS | complete() | status=DONE | P0 |
| DOM-ISS-012 | IN_PROGRESS → OPEN | status=IN_PROGRESS | rejectWork() | status=OPEN | P0 |
| DOM-ISS-013 | DONE → IN_PROGRESS | status=DONE | reopenAfterCompletion() | status=IN_PROGRESS | P0 |
| DOM-ISS-014 | DONE → CONFIRMED | status=DONE | confirm() | status=CONFIRMED | P0 |
| DOM-ISS-015 | DONE → OPEN | status=DONE | rejectCompletion() | status=OPEN | P0 |
| DOM-ISS-016 | CONFIRMED → OPEN | status=CONFIRMED | reissue() | status=OPEN | P0 |
| DOM-ISS-017 | POINT_OUT → OPEN | status=POINT_OUT | assignTo(userId) | status=OPEN, assigneeId=userId | P0 |

#### 2.1.3 状態遷移（異常系 — 禁止遷移）

| ID | テストケース | 前提条件 | 操作 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| DOM-ISS-020 | OPEN → DONE 直接遷移禁止 | status=OPEN | complete() | InvalidStatusTransitionError | P0 |
| DOM-ISS-021 | OPEN → CONFIRMED | status=OPEN | confirm() | InvalidStatusTransitionError | P0 |
| DOM-ISS-022 | POINT_OUT → IN_PROGRESS | status=POINT_OUT | startWork() | InvalidStatusTransitionError | P0 |
| DOM-ISS-023 | POINT_OUT → DONE | status=POINT_OUT | complete() | InvalidStatusTransitionError | P0 |
| DOM-ISS-024 | DONE → DONE | status=DONE | complete() | InvalidStatusTransitionError | P0 |
| DOM-ISS-025 | CONFIRMED → IN_PROGRESS | status=CONFIRMED | startWork() | InvalidStatusTransitionError | P0 |
| DOM-ISS-026 | CONFIRMED → DONE | status=CONFIRMED | complete() | InvalidStatusTransitionError | P0 |
| DOM-ISS-027 | IN_PROGRESS → CONFIRMED | status=IN_PROGRESS | confirm() | InvalidStatusTransitionError | P0 |

#### 2.1.4 担当者変更

| ID | テストケース | 前提条件 | 操作 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| DOM-ISS-030 | OPEN状態で担当変更 | status=OPEN | changeAssignee(newId) | assigneeId=newId | P1 |
| DOM-ISS-031 | DONE状態で担当変更 | status=DONE | changeAssignee(newId) | assigneeId=newId | P1 |
| DOM-ISS-032 | IN_PROGRESS中の担当変更禁止 | status=IN_PROGRESS | changeAssignee(newId) | DomainError throw | P0 |
| DOM-ISS-033 | POINT_OUT→OPEN（初回割当） | status=POINT_OUT | assignTo(userId) | status=OPEN, assigneeId=userId | P0 |

#### 2.1.5 不変性

| ID | テストケース | 前提条件 | 操作 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| DOM-ISS-040 | 状態遷移で新インスタンス生成 | 任意のIssue | startWork() | 元インスタンスは不変、新インスタンス返却 | P1 |
| DOM-ISS-041 | プロパティ変更不可 | 任意のIssue | issue.title = "x" | TypeScriptコンパイルエラー（readonly） | P2 |

---

### 2.2 Location Value Object

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| DOM-LOC-001 | DbId正常生成 | なし | type='dbId', dbId="123" | Location(dbId) | P1 |
| DOM-LOC-002 | DbId空文字 | なし | type='dbId', dbId="" | DomainError throw | P1 |
| DOM-LOC-003 | WorldPosition正常生成 | なし | type='worldPosition', x=1.0,y=2.0,z=3.0 | Location(worldPosition) | P1 |
| DOM-LOC-004 | WorldPosition NaN | なし | x=NaN | DomainError throw | P1 |
| DOM-LOC-005 | WorldPosition Infinity | なし | x=Infinity | DomainError throw | P1 |
| DOM-LOC-006 | isDbId判定 | DbIdLocation | isDbId() | true | P2 |
| DOM-LOC-007 | isWorldPosition判定 | WorldPositionLocation | isWorldPosition() | true | P2 |
| DOM-LOC-008 | 等値比較（同値） | 同じDbId | equals(other) | true | P2 |
| DOM-LOC-009 | 等値比較（異値） | 異なるDbId | equals(other) | false | P2 |
| DOM-LOC-010 | 等値比較（型違い） | DbId vs WorldPosition | equals(other) | false | P2 |
| DOM-LOC-011 | reconstruct | DB復元データ | reconstruct(value) | 同一プロパティのLocation | P2 |

---

### 2.3 Photo エンティティ

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| DOM-PHO-001 | BEFORE写真生成 | なし | phase=Before | isBefore()=true | P2 |
| DOM-PHO-002 | AFTER写真生成 | なし | phase=After | isAfter()=true | P2 |
| DOM-PHO-003 | REJECTION写真生成 | なし | phase=Rejection | isRejection()=true | P2 |
| DOM-PHO-004 | uploadedAt自動設定 | なし | create() | uploadedAtが現在時刻付近 | P2 |
| DOM-PHO-005 | reconstruct | DB復元データ | reconstruct(props) | 全プロパティ復元 | P2 |

---

### 2.4 Coordinate Value Object

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| DOM-CRD-001 | 正常生成 | なし | lat=35.6762, lng=139.7674 | Coordinate | P2 |
| DOM-CRD-002 | 緯度下限 | なし | lat=-90 | 正常生成 | P3 |
| DOM-CRD-003 | 緯度上限 | なし | lat=90 | 正常生成 | P3 |
| DOM-CRD-004 | 緯度超過（下） | なし | lat=-91 | DomainError | P1 |
| DOM-CRD-005 | 緯度超過（上） | なし | lat=91 | DomainError | P1 |
| DOM-CRD-006 | 経度下限 | なし | lng=-180 | 正常生成 | P3 |
| DOM-CRD-007 | 経度上限 | なし | lng=180 | 正常生成 | P3 |
| DOM-CRD-008 | 経度超過 | なし | lng=181 | DomainError | P1 |
| DOM-CRD-009 | 等値比較 | 同座標 | equals(other) | true | P2 |

---

### 2.5 Project 集約ルート

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| DOM-PRJ-001 | 正常生成 | なし | name, startDate < dueDate | Project(Planning) | P2 |
| DOM-PRJ-002 | 名前空文字 | なし | name="" | DomainError | P1 |
| DOM-PRJ-003 | 開始日 > 終了日 | なし | startDate > dueDate | DomainError | P1 |
| DOM-PRJ-004 | ステータス変更 | Planning | changeStatus(Active) | status=Active | P2 |
| DOM-PRJ-005 | 詳細更新 | 任意 | updateDetails(...) | 更新済みProject | P2 |
| DOM-PRJ-006 | isCompleted | status=Completed | isCompleted() | true | P2 |
| DOM-PRJ-007 | isCompleted(false) | status=Active | isCompleted() | false | P2 |

---

### 2.6 Building エンティティ

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| DOM-BLD-001 | 正常生成 | なし | name, address, modelUrn, coordinate | Building | P2 |
| DOM-BLD-002 | 名前空文字 | なし | name="" | DomainError | P1 |
| DOM-BLD-003 | 住所空文字 | なし | address="" | DomainError | P1 |
| DOM-BLD-004 | ModelUrn空文字 | なし | modelUrn="" | DomainError | P1 |

---

### 2.7 Floor エンティティ

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| DOM-FLR-001 | 正常生成 | なし | name="1F", floorNumber=1 | Floor | P2 |
| DOM-FLR-002 | 名前空文字 | なし | name="" | DomainError | P1 |
| DOM-FLR-003 | 小数階番号 | なし | floorNumber=1.5 | DomainError | P1 |

---

### 2.8 User エンティティ

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| DOM-USR-001 | 正常生成 | なし | name, email(有効), role | User | P2 |
| DOM-USR-002 | 名前空文字 | なし | name="" | DomainError | P1 |
| DOM-USR-003 | メール@なし | なし | email="invalid" | DomainError | P1 |
| DOM-USR-004 | isAdmin判定 | role=Admin | isAdmin() | true | P2 |
| DOM-USR-005 | isSupervisor判定 | role=Supervisor | isSupervisor() | true | P2 |
| DOM-USR-006 | isWorker判定 | role=Worker | isWorker() | true | P2 |

---

### 2.9 Organization エンティティ

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| DOM-ORG-001 | 本社生成 | なし | type=Headquarters | Organization | P2 |
| DOM-ORG-002 | 支店生成（親あり） | 本社存在 | type=Branch, parentId | Organization with parent | P2 |
| DOM-ORG-003 | 名前空文字 | なし | name="" | DomainError | P1 |

---

### 2.10 ElementFloorMapping エンティティ

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| DOM-EFM-001 | 正常生成 | なし | buildingId, dbId=100, floorId | Mapping | P2 |
| DOM-EFM-002 | 負のdbId | なし | dbId=-1 | DomainError | P1 |

---

### 2.11 StatusChangeLog エンティティ

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| DOM-SCL-001 | 正常生成 | なし | issueId, from, to, changedBy | Log with changedAt=現在時刻 | P2 |
| DOM-SCL-002 | コメント付き | なし | comment="理由" | comment保存 | P2 |
| DOM-SCL-003 | コメントなし | なし | comment=undefined | comment=undefined | P2 |

---

## 3. アプリケーション層テスト（Command）

### 3.1 CreateIssueHandler

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-CRI-001 | 正常作成（assigneeなし） | Project存在 | 全必須フィールド | issueId返却, status=POINT_OUT | P0 |
| APP-CRI-002 | 正常作成（assigneeあり） | Project存在, User存在 | +assigneeId | issueId返却, status=OPEN | P0 |
| APP-CRI-003 | DbId位置指定 | なし | locationType=dbId, dbId="42" | Location(dbId)保存 | P1 |
| APP-CRI-004 | WorldPosition位置指定 | なし | locationType=worldPosition, x,y,z | Location(worldPosition)保存 | P1 |
| APP-CRI-005 | issueType指定 | なし | issueType="QUALITY" | issueType=Quality | P2 |
| APP-CRI-006 | タイトル空文字 | なし | title="" | DomainError | P1 |
| APP-CRI-007 | 不正locationType | なし | locationType="invalid" | Error | P1 |
| APP-CRI-008 | WorldPosition座標欠落 | なし | locationType=worldPosition, xのみ | Error | P1 |
| APP-CRI-009 | リポジトリ保存確認 | なし | 有効入力 | issueRepository.save()呼出 | P2 |

---

### 3.2 UpdateIssueStatusHandler

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-UIS-001 | OPEN→IN_PROGRESS | Issue(OPEN), assignee=user | newStatus=IN_PROGRESS, changedBy=assignee | 成功, status更新 | P0 |
| APP-UIS-002 | IN_PROGRESS→DONE（After写真あり） | Issue(IN_PROGRESS), After写真1枚以上 | newStatus=DONE | 成功 | P0 |
| APP-UIS-003 | IN_PROGRESS→DONE（After写真なし） | Issue(IN_PROGRESS), After写真0枚 | newStatus=DONE | Error: After写真必要 | P0 |
| APP-UIS-004 | IN_PROGRESS→OPEN | Issue(IN_PROGRESS) | newStatus=OPEN | 成功, status=OPEN | P0 |
| APP-UIS-005 | DONE→CONFIRMED（Supervisor） | Issue(DONE) | newStatus=CONFIRMED, changedBy=Supervisor | 成功 | P0 |
| APP-UIS-006 | DONE→CONFIRMED（Worker） | Issue(DONE) | newStatus=CONFIRMED, changedBy=Worker | Error: 権限不足 | P0 |
| APP-UIS-007 | DONE→OPEN（Rejection写真あり+コメント） | Issue(DONE), Rejection写真あり | newStatus=OPEN, comment="理由" | 成功 | P0 |
| APP-UIS-008 | DONE→OPEN（Rejection写真なし） | Issue(DONE), Rejection写真なし | newStatus=OPEN | Error: Rejection写真必要 | P0 |
| APP-UIS-009 | DONE→OPEN（コメントなし） | Issue(DONE) | newStatus=OPEN, comment未指定 | Error: コメント必要 | P0 |
| APP-UIS-010 | CONFIRMED→OPEN（コメント+Rejection写真） | Issue(CONFIRMED), Rejection写真あり | newStatus=OPEN, comment="再指摘" | 成功 | P0 |
| APP-UIS-011 | CONFIRMED→OPEN（コメントなし） | Issue(CONFIRMED) | newStatus=OPEN | Error: コメント必要 | P0 |
| APP-UIS-012 | 存在しないIssue | なし | issueId=不正 | 404 Not Found | P1 |
| APP-UIS-013 | ProjectId不一致 | Issue存在 | projectId≠issue.projectId | Error: 400 | P1 |
| APP-UIS-014 | 不正なステータス文字列 | なし | newStatus="INVALID" | Error: 400 | P1 |
| APP-UIS-015 | StatusChangeLog生成確認 | 有効遷移 | 任意の有効遷移 | StatusChangeLog保存 | P1 |
| APP-UIS-016 | DONE→IN_PROGRESS（再作業） | Issue(DONE) | newStatus=IN_PROGRESS | 成功 | P0 |

---

### 3.3 AddPhotoHandler

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-APH-001 | BEFORE写真追加 | Issue存在 | file, phase=BEFORE | photoId返却 | P1 |
| APP-APH-002 | AFTER写真追加 | Issue存在 | file, phase=AFTER | photoId返却 | P1 |
| APP-APH-003 | REJECTION写真追加 | Issue存在 | file, phase=REJECTION | photoId返却 | P1 |
| APP-APH-004 | BlobKey形式確認 | Issue存在 | projectId=X, issueId=Y | key=projects/X/issues/Y/photos/{id}.ext | P1 |
| APP-APH-005 | PhotoStorage.upload呼出 | Issue存在 | 有効入力 | upload(key, file, contentType) | P2 |
| APP-APH-006 | 存在しないIssue | なし | issueId=不正 | Error: 404 | P1 |
| APP-APH-007 | DB保存確認 | 正常アップロード後 | なし | photoRepository.save()呼出 | P2 |

---

### 3.4 DeletePhotoHandler

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-DPH-001 | Worker自身の写真削除 | Photo(uploadedBy=worker) | userId=worker, role=Worker | 正常削除 | P1 |
| APP-DPH-002 | Worker他人の写真削除 | Photo(uploadedBy=other) | userId=worker, role=Worker | PhotoDeleteForbiddenError | P0 |
| APP-DPH-003 | Supervisor任意写真削除 | Photo(uploadedBy=worker) | userId=sup, role=Supervisor | 正常削除 | P1 |
| APP-DPH-004 | Admin任意写真削除 | Photo(uploadedBy=worker) | userId=admin, role=Admin | 正常削除 | P1 |
| APP-DPH-005 | 存在しない写真 | なし | photoId=不正 | Error: 404 | P1 |
| APP-DPH-006 | Storage+DB両方削除確認 | Photo存在 | 有効入力 | storage.delete + repo.delete | P2 |

---

### 3.5 AssignIssueHandler

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-ASI-001 | 初回割当（POINT_OUT→OPEN） | Issue(POINT_OUT) | assigneeId=validUser | status=OPEN, assigneeId設定 | P0 |
| APP-ASI-002 | 担当変更（OPEN） | Issue(OPEN) | assigneeId=newUser | assigneeId変更 | P1 |
| APP-ASI-003 | IN_PROGRESS中の変更不可 | Issue(IN_PROGRESS) | assigneeId=newUser | DomainError | P0 |
| APP-ASI-004 | StatusChangeLog記録 | POINT_OUT→OPEN | 有効入力 | ログ保存 | P2 |

---

### 3.6 CreateProjectHandler

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-CPR-001 | 正常作成 | Building存在 | name, startDate, dueDate, buildingId, branchId | projectId返却 | P2 |
| APP-CPR-002 | 開始日>終了日 | なし | startDate > dueDate | DomainError | P1 |
| APP-CPR-003 | 名前空文字 | なし | name="" | DomainError | P1 |

---

### 3.7 UpdateProjectHandler

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-UPR-001 | 正常更新 | Project存在 | 有効な更新データ | 成功 | P2 |
| APP-UPR-002 | 存在しないProject | なし | projectId=不正 | Error: 404 | P1 |
| APP-UPR-003 | 開始日>終了日 | Project存在 | startDate > dueDate | DomainError | P1 |

---

### 3.8 DeleteIssueHandler

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-DIS-001 | 正常削除 | Issue存在 | issueId, projectId | 成功 | P2 |
| APP-DIS-002 | カスケード確認（Photos） | Issue+Photos存在 | issueId | Photos同時削除 | P1 |
| APP-DIS-003 | カスケード確認（Logs） | Issue+Logs存在 | issueId | StatusChangeLogs同時削除 | P1 |
| APP-DIS-004 | 存在しないIssue | なし | issueId=不正 | Error: 404 | P1 |

---

### 3.9 UpdateIssueTitleHandler / UpdateIssueDescriptionHandler

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-UIT-001 | タイトル更新 | Issue存在 | title="新タイトル" | title更新 | P2 |
| APP-UIT-002 | タイトル空文字 | Issue存在 | title="" | DomainError | P1 |
| APP-UID-001 | 説明更新 | Issue存在 | description="新説明" | description更新 | P2 |
| APP-UID-002 | 説明空文字 | Issue存在 | description="" | DomainError | P1 |

---

### 3.10 CreateUserHandler

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-CUS-001 | 正常作成 | Organization存在 | name, email, password, role | userId返却 | P2 |
| APP-CUS-002 | パスワードハッシュ確認 | なし | password="plain" | bcryptハッシュで保存 | P1 |
| APP-CUS-003 | 不正メール | なし | email="invalid" | DomainError | P1 |

---

## 4. アプリケーション層テスト（Query）

### 4.1 listIssues

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-QLI-001 | プロジェクト指定で全件取得 | Issues 3件存在 | projectId | 3件返却 | P1 |
| APP-QLI-002 | フロアフィルタ | Floor1に2件, Floor2に1件 | projectId, floorId=Floor1 | 2件返却 | P1 |
| APP-QLI-003 | ステータスフィルタ（単一） | OPEN=2, DONE=1 | statusFilter=["OPEN"] | 2件返却 | P1 |
| APP-QLI-004 | ステータスフィルタ（複数） | OPEN=2, DONE=1 | statusFilter=["OPEN","DONE"] | 3件返却 | P1 |
| APP-QLI-005 | Worker権限フィルタ | Worker割当2件, 他1件 | userRole=Worker, userId=worker | 2件のみ | P0 |
| APP-QLI-006 | ページネーション（1ページ目） | 15件存在 | page=1, limit=10 | 10件, totalCount=15 | P2 |
| APP-QLI-007 | ページネーション（2ページ目） | 15件存在 | page=2, limit=10 | 5件 | P2 |
| APP-QLI-008 | 空結果 | Issues 0件 | projectId | 0件, totalCount=0 | P2 |
| APP-QLI-009 | dueDate昇順ソート | 異なるdueDate | projectId | dueDate昇順 | P2 |

---

### 4.2 getIssueDetail

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-QID-001 | 正常取得 | Issue+Photos+Logs存在 | issueId | 全情報含むDTO | P1 |
| APP-QID-002 | Photos含む | Issue+Photos2枚 | issueId | photos配列2要素 | P1 |
| APP-QID-003 | StatusChangeLogs含む | Issue+Logs3件 | issueId | logs配列3要素 | P1 |
| APP-QID-004 | 担当者名含む | Issue+assignee設定 | issueId | assigneeName設定 | P2 |
| APP-QID-005 | フロア名含む | Issue+Floor関連 | issueId | floorName設定 | P2 |
| APP-QID-006 | 存在しないIssue | なし | issueId=不正 | null返却 | P1 |

---

### 4.3 listProjects

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-QLP-001 | Admin全件取得 | Projects 3件 | userRole=Admin | 3件返却 | P1 |
| APP-QLP-002 | Supervisor支店フィルタ | Branch1に2件, Branch2に1件 | userRole=Supervisor, orgId=Branch1 | 2件返却 | P1 |
| APP-QLP-003 | Worker担当プロジェクトのみ | Worker割当Issue含むPJ=1件 | userRole=Worker, userId=worker | 1件返却 | P0 |
| APP-QLP-004 | issueCount計算 | PJ内Issues 5件 | projectId | issueCount=5 | P2 |
| APP-QLP-005 | progressRate計算 | DONE=1,CONFIRMED=1,OPEN=2 | projectId | (50+100)/400*100=37.5 | P0 |
| APP-QLP-006 | ページネーション | 25件 | page=1, limit=20 | 20件, totalPages=2 | P2 |

---

### 4.4 getPhotoUrl

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-QPU-001 | 正常URL取得 | Photo存在 | photoId | 署名付きURL文字列 | P1 |
| APP-QPU-002 | 存在しない写真 | なし | photoId=不正 | null返却 | P1 |

---

### 4.5 listAssignableUsers

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-QAU-001 | 全ユーザー取得 | Users 3人 | organizationId=undefined | 3人返却 | P2 |
| APP-QAU-002 | 組織フィルタ | Org1=2人, Org2=1人 | organizationId=Org1 | 2人返却 | P2 |

---

### 4.6 Pagination共通

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| APP-PAG-001 | デフォルトpage | なし | page未指定 | page=1 | P2 |
| APP-PAG-002 | デフォルトlimit | なし | limit未指定 | limit=20 | P2 |
| APP-PAG-003 | limit上限100超過 | なし | limit=200 | limit=100にclamp | P2 |
| APP-PAG-004 | page=0 | なし | page=0 | page=1にclamp | P3 |
| APP-PAG-005 | totalPages計算 | totalCount=55, limit=20 | なし | totalPages=3 | P2 |

---

## 5. API統合テスト

### 5.1 認証・認可共通

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-AUTH-001 | セッションなしリクエスト | 未認証 | 任意の保護エンドポイント | 401 Unauthorized | P0 |
| API-AUTH-002 | 権限不足（Worker→Admin操作） | Worker認証済 | POST /api/projects | 403 Forbidden | P0 |
| API-AUTH-003 | 有効セッション | 認証済 | GET /api/projects | 200 OK | P0 |

---

### 5.2 GET /api/buildings

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-BLD-001 | 建物一覧取得 | Buildings存在 | GET /api/buildings | 200, PaginatedResult | P2 |
| API-BLD-002 | ページネーション | Buildings 25件 | ?page=2&limit=10 | 200, 10件 | P2 |

---

### 5.3 GET /api/buildings/{buildingId}/floors

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-FLR-001 | フロア一覧取得 | Floors存在 | GET /api/buildings/{id}/floors | 200, FloorDto[] | P2 |
| API-FLR-002 | 存在しないBuilding | なし | GET /api/buildings/invalid/floors | 200, 空配列 | P2 |

---

### 5.4 PATCH /api/buildings/{buildingId}/floors

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-FLU-001 | フロア標高一括更新 | Floors存在 | elevations配列 | 200, updated件数 | P2 |

---

### 5.5 GET /api/projects

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-PRJ-001 | Admin全件取得 | Admin認証 | GET /api/projects | 200, 全PJ | P1 |
| API-PRJ-002 | Worker担当のみ | Worker認証 | GET /api/projects | 200, 担当PJのみ | P1 |
| API-PRJ-003 | ページネーション | 25件存在 | ?page=1&limit=10 | 200, 10件, totalCount=25 | P2 |

---

### 5.6 POST /api/projects

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-CPR-001 | Admin正常作成 | Admin認証 | 有効body | 201, { projectId } | P2 |
| API-CPR-002 | Worker作成不可 | Worker認証 | 有効body | 403 | P0 |
| API-CPR-003 | Supervisor作成不可 | Supervisor認証 | 有効body | 403 | P1 |

---

### 5.7 GET /api/projects/{id}

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-GPR-001 | 正常取得 | Project存在 | GET /api/projects/{id} | 200, ProjectDetailDto | P2 |
| API-GPR-002 | 存在しないID | なし | GET /api/projects/invalid | 404 | P1 |

---

### 5.8 POST /api/projects/{id}/issues

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-CIS-001 | multipart正常作成（BEFORE写真付） | Admin認証, Project存在 | FormData(全フィールド+写真) | 201, { issueId } | P0 |
| API-CIS-002 | JSON正常作成 | Admin認証 | application/json body | 201 | P2 |
| API-CIS-003 | 写真なし（multipart） | Admin認証 | FormData(写真なし) | 400, 写真必須エラー | P0 |
| API-CIS-004 | 不正拡張子 | Admin認証 | FormData(file.gif) | 400, 不正拡張子 | P1 |
| API-CIS-005 | Worker作成不可 | Worker認証 | 有効FormData | 403 | P0 |
| API-CIS-006 | locationType=worldPosition（座標欠落） | Admin認証 | worldPositionX=1のみ | 400 | P1 |
| API-CIS-007 | 有効拡張子確認（jpg） | Admin認証 | file.jpg | 201 | P2 |
| API-CIS-008 | 有効拡張子確認（png） | Admin認証 | file.png | 201 | P2 |
| API-CIS-009 | 有効拡張子確認（webp） | Admin認証 | file.webp | 201 | P2 |
| API-CIS-010 | assigneeId付き作成 | Admin認証 | +assigneeId | 201, status=OPEN | P1 |
| API-CIS-011 | photoPhase=BEFORE以外はエラー | Admin認証 | photoPhase=AFTER | 400 | P1 |

---

### 5.9 GET /api/projects/{id}/issues

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-LIS-001 | 全件取得 | Issues 5件 | GET /api/projects/{id}/issues | 200, 5件 | P1 |
| API-LIS-002 | floorIdフィルタ | Floor1に3件 | ?floorId=floor1 | 200, 3件 | P1 |
| API-LIS-003 | statusフィルタ（カンマ区切り） | OPEN=2,DONE=1 | ?status=OPEN,DONE | 200, 3件 | P1 |
| API-LIS-004 | Worker権限フィルタ | Worker認証 | GET | 200, 担当分のみ | P0 |
| API-LIS-005 | ページネーション | 30件 | ?page=2&limit=10 | 200, 10件 | P2 |

---

### 5.10 GET /api/projects/{id}/issues/{issueId}

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-GIS-001 | 正常取得 | Issue存在 | GET | 200, IssueDetailDto | P1 |
| API-GIS-002 | 存在しないIssue | なし | GET /invalid | 404 | P1 |
| API-GIS-003 | Photos含む | Issue+Photos | GET | 200, photos配列 | P2 |
| API-GIS-004 | StatusChangeLogs含む | Issue+Logs | GET | 200, logs配列 | P2 |

---

### 5.11 PATCH /api/projects/{id}/issues/{issueId}/status

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-STA-001 | OPEN→IN_PROGRESS | Issue(OPEN), assignee認証 | { status: "IN_PROGRESS" } | 200 | P0 |
| API-STA-002 | IN_PROGRESS→DONE（After写真あり） | Issue(IN_PROGRESS), After写真 | { status: "DONE" } | 200 | P0 |
| API-STA-003 | IN_PROGRESS→DONE（After写真なし） | Issue(IN_PROGRESS), After写真0 | { status: "DONE" } | 400 | P0 |
| API-STA-004 | DONE→CONFIRMED（Supervisor） | Issue(DONE), Supervisor認証 | { status: "CONFIRMED" } | 200 | P0 |
| API-STA-005 | DONE→CONFIRMED（Worker） | Issue(DONE), Worker認証 | { status: "CONFIRMED" } | 403 | P0 |
| API-STA-006 | OPEN→DONE禁止 | Issue(OPEN) | { status: "DONE" } | 400 | P0 |
| API-STA-007 | DONE→OPEN（コメント+Rejection写真） | Issue(DONE), Rejection写真 | { status: "OPEN", comment: "理由" } | 200 | P0 |
| API-STA-008 | DONE→OPEN（コメントなし） | Issue(DONE) | { status: "OPEN" } | 400 | P0 |
| API-STA-009 | 不正ステータス文字列 | Issue存在 | { status: "INVALID" } | 400 | P1 |
| API-STA-010 | 存在しないIssue | なし | PATCH /invalid | 404 | P1 |

---

### 5.12 PATCH /api/projects/{id}/issues/{issueId}/assignee

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-ASN-001 | 初回割当（Supervisor） | Issue(POINT_OUT), Supervisor認証 | { assigneeId } | 200 | P0 |
| API-ASN-002 | 担当変更（Admin） | Issue(OPEN), Admin認証 | { assigneeId } | 200 | P1 |
| API-ASN-003 | Worker割当不可 | Worker認証 | { assigneeId } | 403 | P0 |
| API-ASN-004 | IN_PROGRESS中変更不可 | Issue(IN_PROGRESS) | { assigneeId } | 400 | P0 |

---

### 5.13 POST /api/projects/{id}/issues/{issueId}/photos

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-UPH-001 | 単一写真アップロード | Issue存在 | FormData(1ファイル, phase=AFTER) | 200, photoId | P1 |
| API-UPH-002 | 複数写真アップロード | Issue存在 | FormData(3ファイル) | 200, uploadedCount=3 | P1 |
| API-UPH-003 | ファイルなし | Issue存在 | FormData(ファイルなし) | 400 | P1 |
| API-UPH-004 | 不正拡張子 | Issue存在 | FormData(file.bmp) | 400 | P1 |
| API-UPH-005 | 存在しないIssue | なし | FormData(有効) | 404 | P1 |

---

### 5.14 GET /api/photos/{photoId}/url

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-PUR-001 | 署名付きURL取得 | Photo存在 | GET /api/photos/{id}/url | 200, { url } | P1 |
| API-PUR-002 | 存在しない写真 | なし | GET /api/photos/invalid/url | 404 | P1 |

---

### 5.15 GET /api/viewer/token

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-VTK-001 | トークン取得 | APS設定済 | GET /api/viewer/token | 200, { token, expiresIn } | P1 |
| API-VTK-002 | 未認証 | セッションなし | GET /api/viewer/token | 401 | P1 |

---

### 5.16 GET /api/auth/me

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-AME-001 | 認証済ユーザー情報 | セッション有効 | GET /api/auth/me | 200, ユーザー情報 | P1 |
| API-AME-002 | 未認証 | セッションなし | GET /api/auth/me | 401 | P1 |

---

### 5.17 Users API

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-USR-001 | ユーザー一覧 | 認証済 | GET /api/users | 200, UserDto[] | P2 |
| API-USR-002 | ユーザー作成（Admin） | Admin認証 | POST /api/users body | 201, { userId } | P2 |
| API-USR-003 | ユーザー作成（Worker） | Worker認証 | POST /api/users body | 403 | P1 |
| API-USR-004 | ユーザー更新（Admin） | Admin認証, User存在 | PATCH /api/users/{id} | 200 | P2 |
| API-USR-005 | 担当可能ユーザー一覧 | 認証済 | GET /api/assignable-users | 200, UserDto[] | P2 |

---

### 5.18 Organizations API

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-ORG-001 | 組織一覧 | 認証済 | GET /api/organizations | 200, Org[] | P2 |
| API-ORG-002 | 組織作成（Admin） | Admin認証 | POST /api/organizations | 201 | P2 |
| API-ORG-003 | 組織作成（Worker） | Worker認証 | POST /api/organizations | 403 | P1 |
| API-ORG-004 | 組織更新（Admin） | Admin認証 | PATCH /api/organizations/{id} | 200 | P2 |
| API-ORG-005 | 組織削除（Admin） | Admin認証 | DELETE /api/organizations/{id} | 200 | P2 |

---

### 5.19 Element Floor Mapping API

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-EFM-001 | dbIdからフロア特定 | Mapping存在 | GET ?dbId=100 | 200, FloorMapping | P2 |
| API-EFM-002 | 該当なしdbId | なし | GET ?dbId=999 | 404 | P2 |

---

### 5.20 エラーレスポンス形式

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| API-ERR-001 | DomainError → 400 | バリデーション違反 | 不正入力 | 400, { error, details } | P1 |
| API-ERR-002 | Not Found → 404 | リソース不在 | 不正ID | 404, { error } | P1 |
| API-ERR-003 | 認可エラー → 403 | 権限不足 | 権限外操作 | 403, { error } | P1 |
| API-ERR-004 | 未認証 → 401 | セッションなし | 保護エンドポイント | 401, { error } | P1 |
| API-ERR-005 | 不正Content-Type → 415 | なし | text/plain送信 | 415 | P3 |

---

## 6. インフラ層テスト

### 6.1 PrismaIssueRepository

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| INF-IRE-001 | save（新規作成） | DB空 | Issue集約 | DB行作成、全フィールド一致 | P1 |
| INF-IRE-002 | save（更新upsert） | 既存Issue | 変更済Issue | DB行更新 | P1 |
| INF-IRE-003 | findById（存在） | DB内Issue | issueId | Issue集約復元 | P1 |
| INF-IRE-004 | findById（不在） | DB空 | 不正issueId | null | P1 |
| INF-IRE-005 | findByProjectId | PJに3件 | projectId | Issue[] 3件 | P1 |
| INF-IRE-006 | findByProjectIdAndFloorId | Floor1に2件 | projectId, floorId | Issue[] 2件 | P1 |
| INF-IRE-007 | delete（カスケード） | Issue+Photos+Logs | issueId | 全関連レコード削除 | P1 |
| INF-IRE-008 | Location(dbId)のマッピング | dbId=42 | save+findById | Location(dbId="42")復元 | P1 |
| INF-IRE-009 | Location(worldPosition)のマッピング | x=1,y=2,z=3 | save+findById | Location(worldPosition)復元 | P1 |

---

### 6.2 PrismaPhotoRepository

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| INF-PRE-001 | save | DB空 | Photo | DB行作成 | P2 |
| INF-PRE-002 | findById | Photo存在 | photoId | Photo復元 | P2 |
| INF-PRE-003 | findByIssueId | Photos 3枚 | issueId | Photo[] 3枚 | P2 |
| INF-PRE-004 | delete | Photo存在 | photoId | DB行削除 | P2 |

---

### 6.3 MinioPhotoStorage

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| INF-MIO-001 | upload正常 | MinIO稼働 | key, file, contentType | オブジェクト保存成功 | P1 |
| INF-MIO-002 | バケット自動作成 | バケット未存在 | upload() | バケット作成後にアップロード | P2 |
| INF-MIO-003 | getUrl（署名付き） | オブジェクト存在 | key | 有効な署名付きURL | P1 |
| INF-MIO-004 | delete | オブジェクト存在 | key | オブジェクト削除 | P2 |
| INF-MIO-005 | キー形式確認 | なし | upload("projects/x/issues/y/photos/z.jpg",...) | 正しいパスで保存 | P2 |

---

### 6.4 ApsViewerTokenProvider

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| INF-APS-001 | 初回トークン取得 | 環境変数設定済 | getAccessToken() | { token, expiresIn } | P1 |
| INF-APS-002 | キャッシュ利用 | 有効トークンキャッシュ済 | getAccessToken() | API呼出なし、キャッシュ返却 | P2 |
| INF-APS-003 | 期限切れ時リフレッシュ | 期限切れトークン | getAccessToken() | 新トークン取得 | P2 |
| INF-APS-004 | 60秒バッファ | 残り59秒 | getAccessToken() | リフレッシュ実行 | P3 |
| INF-APS-005 | 認証情報不正 | CLIENT_ID不正 | getAccessToken() | Error throw | P1 |

---

### 6.5 PrismaProjectRepository

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| INF-PJR-001 | save（新規） | DB空 | Project | DB行作成 | P2 |
| INF-PJR-002 | findById | Project存在 | projectId | Project復元 | P2 |
| INF-PJR-003 | findAll | Projects 3件 | なし | Project[] 3件 | P2 |

---

### 6.6 他Repository

| ID | テストケース | 前提条件 | 入力 | 期待結果 | 優先度 |
|----|-------------|---------|------|---------|--------|
| INF-BRE-001 | Building findAll | Buildings存在 | なし | Building[] | P2 |
| INF-FRE-001 | Floor findByBuildingId | Floors存在 | buildingId | Floor[] | P2 |
| INF-FRE-002 | Floor bulkUpsert | 新規+既存 | Floor[] | 全件upsert | P2 |
| INF-URE-001 | User save+findById | なし | User | 保存+復元 | P2 |
| INF-URE-002 | User findByEmail | User存在 | email | User | P2 |
| INF-SCR-001 | StatusChangeLog save+findByIssueId | なし | Log | 保存+取得 | P2 |
| INF-EFR-001 | ElementFloorMapping findByBuildingIdAndDbId | Mapping存在 | buildingId, dbId | Mapping | P2 |
| INF-EFR-002 | ElementFloorMapping bulkUpsert | 新規 | Mappings[] | 全件upsert | P2 |

---

## 7. E2Eシナリオテスト

### 7.1 指摘ライフサイクル（最重要ワークフロー）

| ID | シナリオ | 手順 | 期待結果 | 優先度 |
|----|---------|------|---------|--------|
| E2E-001 | 指摘作成→割当→着手→是正完了→承認 | 1. Supervisor: Issue作成（BEFORE写真付）<br>2. Supervisor: Worker割当（POINT_OUT→OPEN）<br>3. Worker: 着手（OPEN→IN_PROGRESS）<br>4. Worker: AFTER写真アップロード<br>5. Worker: 是正完了（IN_PROGRESS→DONE）<br>6. Supervisor: 承認（DONE→CONFIRMED） | 各ステータス正常遷移、StatusChangeLog 5件 | P0 |
| E2E-002 | 是正差し戻しフロー | 1. Issue(IN_PROGRESS)状態<br>2. Worker: 是正完了（→DONE）<br>3. Supervisor: 否認+Rejection写真+コメント（→OPEN）<br>4. Supervisor: 再割当<br>5. Worker: 再着手（→IN_PROGRESS）<br>6. Worker: AFTER写真再アップロード<br>7. Worker: 是正完了（→DONE）<br>8. Supervisor: 承認（→CONFIRMED） | 状態遷移とログ全記録 | P0 |
| E2E-003 | 確認後の再指摘 | 1. Issue(CONFIRMED)状態<br>2. Supervisor: 再指摘+Rejection写真+コメント（→OPEN）<br>3. Worker: 着手→完了→承認 | CONFIRMED→OPEN→...正常遷移 | P0 |

---

### 7.2 権限境界テスト

| ID | シナリオ | 手順 | 期待結果 | 優先度 |
|----|---------|------|---------|--------|
| E2E-010 | Worker制限検証 | 1. Worker: Issue作成試行→403<br>2. Worker: 担当外Issue参照→フィルタ除外<br>3. Worker: 他人の写真削除→403<br>4. Worker: CONFIRMED遷移→403 | 全て権限エラー | P0 |
| E2E-011 | Supervisor範囲検証 | 1. Supervisor: 支店内PJ一覧→自支店のみ<br>2. Supervisor: Issue作成→成功<br>3. Supervisor: 任意写真削除→成功<br>4. Supervisor: DONE→CONFIRMED→成功 | 支店スコープ適用 | P1 |
| E2E-012 | Admin全権検証 | 1. Admin: 全PJ参照→全件<br>2. Admin: PJ作成→成功<br>3. Admin: ユーザー作成→成功<br>4. Admin: 組織作成→成功 | 全操作成功 | P1 |

---

### 7.3 写真管理フロー

| ID | シナリオ | 手順 | 期待結果 | 優先度 |
|----|---------|------|---------|--------|
| E2E-020 | 写真アップロード→URL取得 | 1. Issue作成（BEFORE写真付）<br>2. AFTER写真追加<br>3. 各写真のURL取得 | 署名付きURLでアクセス可能 | P1 |
| E2E-021 | 写真必須チェック | 1. After写真なしでDONE遷移→400<br>2. After写真追加<br>3. DONE遷移→成功 | 写真必須ルール適用 | P0 |
| E2E-022 | 写真削除権限 | 1. Worker: 自身の写真削除→成功<br>2. Worker: 他人の写真削除→403<br>3. Supervisor: 任意写真削除→成功 | 権限制御適用 | P1 |

---

### 7.4 ビューアー連携

| ID | シナリオ | 手順 | 期待結果 | 優先度 |
|----|---------|------|---------|--------|
| E2E-030 | APS Viewerトークン取得 | 1. 認証済みで/api/viewer/token | 有効トークン返却 | P1 |
| E2E-031 | BIM要素→フロア特定 | 1. 3Dモデルで要素ダブルクリック（dbId取得）<br>2. /api/buildings/{id}/element-floor-mapping?dbId=X<br>3. 該当フロア返却 | dbIdからfloorId解決 | P2 |
| E2E-032 | 指摘マーカー表示 | 1. Viewerページロード<br>2. Issues取得<br>3. WorldPosition/DbIdから2D座標変換<br>4. マーカー色分け表示 | ステータス色: OPEN=赤, IN_PROGRESS=黄, DONE=緑 | P2 |

---

### 7.5 プロジェクト管理

| ID | シナリオ | 手順 | 期待結果 | 優先度 |
|----|---------|------|---------|--------|
| E2E-040 | PJ進捗率計算検証 | 1. PJ内Issue 4件作成<br>2. 1件DONE, 1件CONFIRMED<br>3. GET /api/projects | progressRate = (50+100)/400*100 = 37.5% | P1 |
| E2E-041 | PJ CRUD | 1. Admin: PJ作成<br>2. PJ詳細取得<br>3. PJ更新<br>4. PJ一覧で確認 | 全CRUD正常 | P2 |

---

### 7.6 データ整合性

| ID | シナリオ | 手順 | 期待結果 | 優先度 |
|----|---------|------|---------|--------|
| E2E-050 | Issue削除のカスケード | 1. Issue作成+写真+ステータス変更<br>2. Issue削除<br>3. 関連Photos確認→0件<br>4. 関連Logs確認→0件 | カスケード削除完全 | P1 |
| E2E-051 | 同時更新整合性 | 1. 同一Issueに対し2つの状態遷移を同時実行 | 一方成功、一方エラー（楽観的排他制御 or 最後の書き込み勝ち） | P3 |

---

## 付録A: 状態遷移マトリクス

Issue Status 全遷移パターンの網羅表。

| 現在\操作 | assignTo | startWork | complete | rejectWork | confirm | rejectCompletion | reopenAfterCompletion | reissue | changeAssignee |
|-----------|----------|-----------|----------|------------|---------|------------------|----------------------|---------|---------------|
| **POINT_OUT** | → OPEN | **NG** | **NG** | **NG** | **NG** | **NG** | **NG** | **NG** | **NG** |
| **OPEN** | - | → IN_PROGRESS | **NG** | **NG** | **NG** | **NG** | **NG** | **NG** | OK (担当変更) |
| **IN_PROGRESS** | - | **NG** | → DONE | → OPEN | **NG** | **NG** | **NG** | **NG** | **NG** |
| **DONE** | - | **NG** | **NG** | **NG** | → CONFIRMED | → OPEN | → IN_PROGRESS | **NG** | OK (担当変更) |
| **CONFIRMED** | - | **NG** | **NG** | **NG** | **NG** | **NG** | **NG** | → OPEN | OK (担当変更) |

- **NG** = InvalidStatusTransitionError
- **OK** = 状態変化なし（プロパティ変更のみ）
- **→ X** = 状態遷移成功

---

## 付録B: 写真要件マトリクス

| 遷移 | 必要写真 | Phase | 最低枚数 |
|------|---------|-------|---------|
| Issue作成 | BEFORE写真 | BEFORE | 1枚 |
| IN_PROGRESS → DONE | AFTER写真 | AFTER | 1枚 |
| DONE → OPEN | REJECTION写真 | REJECTION | 1枚 |
| CONFIRMED → OPEN | REJECTION写真 | REJECTION | 1枚 |

---

## 付録C: 権限マトリクス

| 操作 | Admin | Supervisor | Worker |
|------|-------|------------|--------|
| プロジェクト作成 | OK | NG | NG |
| プロジェクト更新 | OK | NG | NG |
| プロジェクト一覧 | 全件 | 支店内 | 担当Issue関連のみ |
| Issue作成 | OK | OK | NG |
| Issue一覧 | 全件 | 全件 | 担当のみ |
| ステータス変更（一般） | OK | OK | 担当分のみ |
| ステータス→CONFIRMED | OK | OK | NG |
| 担当者割当/変更 | OK | OK | NG |
| 写真アップロード | OK | OK | OK |
| 写真削除（自分の） | OK | OK | OK |
| 写真削除（他人の） | OK | OK | NG |
| ユーザー作成 | OK | NG | NG |
| 組織作成/更新/削除 | OK | NG | NG |

---

## 付録D: テストケース集計

| カテゴリ | P0 | P1 | P2 | P3 | 合計 |
|---------|----|----|----|----|------|
| ドメイン層 | 20 | 24 | 30 | 5 | 79 |
| アプリケーション層（Command） | 11 | 22 | 14 | 0 | 47 |
| アプリケーション層（Query） | 3 | 10 | 14 | 1 | 28 |
| API統合テスト | 16 | 22 | 18 | 2 | 58 |
| インフラ層 | 0 | 12 | 15 | 1 | 28 |
| E2Eシナリオ | 5 | 7 | 5 | 1 | 18 |
| **合計** | **55** | **97** | **96** | **10** | **258** |
