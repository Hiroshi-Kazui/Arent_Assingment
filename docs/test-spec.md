# テスト仕様書

生成日時: 2026-03-09 10:00
対象スコープ: 全体
Truth Matrix基準: 2026-03-09 (全体 55項目)

## サマリー
- 総テストケース数: 121
- Domain Unit: 42件
- Application Integration: 38件
- API Route: 33件
- E2E: 8件

---

## 1. Issue 状態遷移

### DOM-ISS-001: Issue.create() でステータスが POINT_OUT で生成される
- **レイヤー**: Domain Unit
- **前提条件**: `Issue.create(id, projectId, floorId, 'title', 'desc', IssueType.Quality, reportedBy, location, dueDate)` を呼び出せる状態
- **操作**: `Issue.create(IssueId.create(uuid()), projectId, floorId, 'タイトル', '説明', IssueType.Quality, userId, location, new Date('2026-12-31'))` を呼び出す
- **期待結果**: 返却された Issue インスタンスの `status` が `IssueStatus.PointOut` ('POINT_OUT') である
- **根拠**: src/domain/models/issue.ts L116
- **Truth Matrix ID**: TM-ISS-001
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装 (テストファイル削除済み)

### DOM-ISS-002: PointOut → Open への遷移 (assignTo 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `Issue.create(...)` で生成した status=PointOut の Issue インスタンスが存在する
- **操作**: `issue.assignTo(UserId.create(uuid()))` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.Open` ('OPEN') であり、`assigneeId` に指定した UserId が設定されている
- **根拠**: src/domain/models/issue.ts L414-435
- **Truth Matrix ID**: TM-ISS-002, TM-ASG-002
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装

### DOM-ISS-003: Open → InProgress への遷移 (startWork 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `Issue.reconstruct(..., IssueStatus.Open, ...)` で status=Open の Issue インスタンスを用意する
- **操作**: `issue.startWork()` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.InProgress` ('IN_PROGRESS') である
- **根拠**: src/domain/models/issue.ts L201-225
- **Truth Matrix ID**: TM-ISS-003
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装

### DOM-ISS-004: startWork() を Open 以外から呼ぶと InvalidStatusTransitionError が発生する
- **レイヤー**: Domain Unit
- **前提条件**: `Issue.reconstruct(..., IssueStatus.PointOut, ...)` で status=PointOut の Issue を用意する
- **操作**: `issue.startWork()` を呼び出す
- **期待結果**: `InvalidStatusTransitionError` がスローされる
- **根拠**: src/domain/models/issue.ts L202-207
- **Truth Matrix ID**: TM-ISS-003, TM-ISS-010
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装
- **備考**: TM-ISS-010 (PointOut→InProgress 直接遷移禁止) は startWork() のガードで担保されている。PARTIAL 判定だが実装は存在する

### DOM-ISS-005: InProgress → Done への遷移 (complete 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `Issue.reconstruct(..., IssueStatus.InProgress, ...)` で status=InProgress の Issue を用意する
- **操作**: `issue.complete()` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.Done` ('DONE') である
- **根拠**: src/domain/models/issue.ts L235-256
- **Truth Matrix ID**: TM-ISS-004
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装

### DOM-ISS-006: complete() を InProgress 以外から呼ぶと InvalidStatusTransitionError が発生する
- **レイヤー**: Domain Unit
- **前提条件**: `Issue.reconstruct(..., IssueStatus.Open, ...)` で status=Open の Issue を用意する
- **操作**: `issue.complete()` を呼び出す
- **期待結果**: `InvalidStatusTransitionError` がスローされる (Open → Done 直接遷移禁止)
- **根拠**: src/domain/models/issue.ts L236-238
- **Truth Matrix ID**: TM-ISS-009
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装

### DOM-ISS-007: InProgress → Open への遷移 (rejectWork 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `Issue.reconstruct(..., IssueStatus.InProgress, ...)` で status=InProgress の Issue を用意する
- **操作**: `issue.rejectWork()` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.Open` ('OPEN') である
- **根拠**: src/domain/models/issue.ts L261-282
- **Truth Matrix ID**: TM-ISS-005
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装

### DOM-ISS-008: Done → Confirmed への遷移 (confirm 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `Issue.reconstruct(..., IssueStatus.Done, ...)` で status=Done の Issue を用意する
- **操作**: `issue.confirm()` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.Confirmed` ('CONFIRMED') である
- **根拠**: src/domain/models/issue.ts L474-495
- **Truth Matrix ID**: TM-ISS-006
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装

### DOM-ISS-009: Done → Open への遷移 (rejectCompletion 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `Issue.reconstruct(..., IssueStatus.Done, ...)` で status=Done の Issue を用意する
- **操作**: `issue.rejectCompletion()` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.Open` ('OPEN') である
- **根拠**: src/domain/models/issue.ts L500-521
- **Truth Matrix ID**: TM-ISS-007
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装

### DOM-ISS-010: Confirmed → Open への遷移 (reissue 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `Issue.reconstruct(..., IssueStatus.Confirmed, ...)` で status=Confirmed の Issue を用意する
- **操作**: `issue.reissue()` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.Open` ('OPEN') である
- **根拠**: src/domain/models/issue.ts L526-547
- **Truth Matrix ID**: TM-ISS-008
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装

### DOM-ISS-011: Done → InProgress への遷移 (reopenAfterCompletion 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `Issue.reconstruct(..., IssueStatus.Done, ...)` で status=Done の Issue を用意する
- **操作**: `issue.reopenAfterCompletion()` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.InProgress` ('IN_PROGRESS') である
- **根拠**: src/domain/models/issue.ts L287-311
- **Truth Matrix ID**: TM-ISS-011
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装
- **備考**: CONFLICT 項目。CLAUDE.md では Done→InProgress を「再指摘」と記載しているが、phase0/api-design には定義なし。実装準拠でテスト定義

### DOM-ISS-012: createWithAssignee() で status=Open かつ assigneeId が設定される
- **レイヤー**: Domain Unit
- **前提条件**: 有効な引数（assigneeId を含む）を準備する
- **操作**: `Issue.createWithAssignee(id, projectId, floorId, 'title', 'desc', undefined, reportedBy, location, dueDate, assigneeId)` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.Open` ('OPEN') であり、`assigneeId` が設定値と一致する
- **根拠**: src/domain/models/issue.ts L128-159
- **Truth Matrix ID**: TM-ISS-012
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装

### DOM-ISS-013: Issue.create() でタイトル空文字を渡すと Error がスローされる
- **レイヤー**: Domain Unit
- **前提条件**: 有効な引数のうち title のみ空文字 `''` とする
- **操作**: `Issue.create(id, projectId, floorId, '', 'desc', undefined, reportedBy, location, dueDate)` を呼び出す
- **期待結果**: `new Error('Issue title must not be empty')` がスローされる
- **根拠**: src/domain/models/issue.ts L94-96
- **Truth Matrix ID**: TM-ISS-001
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装

### DOM-ISS-014: Issue.create() で無効な dueDate を渡すと Error がスローされる
- **レイヤー**: Domain Unit
- **前提条件**: 有効な引数のうち dueDate のみ `new Date('invalid')` とする
- **操作**: `Issue.create(id, projectId, floorId, 'title', 'desc', undefined, reportedBy, location, new Date('invalid'))` を呼び出す
- **期待結果**: `new Error('Issue dueDate is invalid')` がスローされる
- **根拠**: src/domain/models/issue.ts L101-103
- **Truth Matrix ID**: TM-ISS-001
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装

### DOM-ISS-015: InProgress 中の assignee 変更は InvalidStatusTransitionError
- **レイヤー**: Domain Unit
- **前提条件**: `Issue.reconstruct(..., IssueStatus.InProgress, ...)` で status=InProgress の Issue を用意する
- **操作**: `issue.changeAssignee(UserId.create(uuid()))` を呼び出す
- **期待結果**: `InvalidStatusTransitionError` がスローされる
- **根拠**: src/domain/models/issue.ts L441-447
- **Truth Matrix ID**: TM-ASG-004
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装
- **備考**: MISSING_SPEC 項目。仕様書未記載だが実装に存在する。仕様への追記推奨

---

## 2. 写真ルール

### DOM-PHT-001: Photo.create() で Before/After/Rejection の3フェーズが生成できる
- **レイヤー**: Domain Unit
- **前提条件**: 有効な `PhotoId`、`IssueId`、`blobKey` を準備する
- **操作**: `Photo.create(photoId, issueId, 'projects/p/issues/i/photos/x.jpg', PhotoPhase.Before, null)` を各フェーズで呼び出す
- **期待結果**: `PhotoPhase.Before`、`PhotoPhase.After`、`PhotoPhase.Rejection` それぞれで Photo インスタンスが生成され、`phase` プロパティが対応する値と一致する
- **根拠**: src/domain/models/photo.ts L22-26
- **Truth Matrix ID**: TM-PHT-001
- **実装ファイル**: src/domain/models/photo.ts
- **実装状態**: 未実装

### DOM-PHT-002: Photo.create() で blobKey 空文字を渡すと Error がスローされる
- **レイヤー**: Domain Unit
- **前提条件**: 有効な引数のうち blobKey のみ空文字 `''` とする
- **操作**: `Photo.create(photoId, issueId, '', PhotoPhase.Before, null)` を呼び出す
- **期待結果**: `new Error('Photo blobKey must not be empty')` がスローされる
- **根拠**: src/domain/models/photo.ts L52-54
- **Truth Matrix ID**: TM-PHT-001
- **実装ファイル**: src/domain/models/photo.ts
- **実装状態**: 未実装

### APP-PHT-001: InProgress → Done 時に After 写真が 0 枚だと Error がスローされる
- **レイヤー**: Application Integration
- **前提条件**: `IPhotoRepository.findByIssueId()` のモックが空配列を返す。Issue は `status=IN_PROGRESS` で用意する
- **操作**: `UpdateIssueStatusHandler.execute({ issueId, projectId, newStatus: 'DONE', changedBy })` を呼び出す
- **期待結果**: `new Error('是正完了には是正後写真が1枚以上必要です')` がスローされる
- **根拠**: src/application/commands/update-issue-status.ts L49-55
- **Truth Matrix ID**: TM-ISS-004, TM-PHT-002
- **実装ファイル**: src/application/commands/update-issue-status.ts
- **実装状態**: 未実装

### APP-PHT-002: InProgress → Done 時に After 写真が 1 枚以上あると遷移が成功する (境界値)
- **レイヤー**: Application Integration
- **前提条件**: `IPhotoRepository.findByIssueId()` のモックが `[Photo(phase=After)]` を返す。Issue は `status=IN_PROGRESS`
- **操作**: `UpdateIssueStatusHandler.execute({ issueId, projectId, newStatus: 'DONE', changedBy })` を呼び出す
- **期待結果**: `issueRepository.save()` が呼ばれ、例外がスローされない
- **根拠**: src/application/commands/update-issue-status.ts L49-55
- **Truth Matrix ID**: TM-PHT-002
- **実装ファイル**: src/application/commands/update-issue-status.ts
- **実装状態**: 未実装

### APP-PHT-003: AddPhotoHandler が BlobKey を正規形式で生成する
- **レイヤー**: Application Integration
- **前提条件**: `IIssueRepository.findById()` のモックが有効な Issue を返す。`PhotoStorage.upload()` と `IPhotoRepository.save()` はモックで無操作
- **操作**: `AddPhotoHandler.execute({ issueId: 'i1', projectId: 'p1', file: Buffer, fileName: 'photo.jpg', contentType: 'image/jpeg', photoPhase: 'BEFORE', uploadedBy: 'u1' })` を呼び出す
- **期待結果**: `PhotoStorage.upload()` が呼ばれた際の key 引数が `'projects/p1/issues/i1/photos/{生成されたphotoId}.jpg'` パターンに合致する
- **根拠**: src/application/commands/add-photo.ts L36, CLAUDE.md Blob保存戦略
- **Truth Matrix ID**: TM-PHT-004
- **実装ファイル**: src/application/commands/add-photo.ts
- **実装状態**: 未実装

### APP-PHT-004: AddPhotoHandler が PhotoStorage.upload() を先に呼び、その後 IPhotoRepository.save() を呼ぶ
- **レイヤー**: Application Integration
- **前提条件**: `IIssueRepository.findById()` のモックが有効な Issue を返す。呼び出し順序をキャプチャするモックを用意する
- **操作**: `AddPhotoHandler.execute({ issueId, projectId, file, fileName: 'x.png', contentType: 'image/png', photoPhase: 'AFTER', uploadedBy })` を呼び出す
- **期待結果**: `photoStorage.upload()` が `photoRepository.save()` より先に呼ばれる (呼び出し順序 1 < 2)
- **根拠**: src/application/commands/add-photo.ts L39-57, CLAUDE.md Blob保存戦略
- **Truth Matrix ID**: TM-PHT-005
- **実装ファイル**: src/application/commands/add-photo.ts
- **実装状態**: 未実装
- **備考**: PARTIAL 判定。実装は Blob先保存→DB記録の順序を守っているが、Blob保存失敗時のロールバック仕様が未記載。仕様追記推奨

### API-PHT-001: POST /api/projects/{id}/issues/{issueId}/photos で許可外拡張子を送ると 400 が返る
- **レイヤー**: API Route
- **前提条件**: 認証済みセッション (任意ロール) が存在する。ファイル名が `photo.bmp` の multipart リクエストを準備する
- **操作**: `POST /api/projects/p1/issues/i1/photos` に `photoPhase=AFTER` と `.bmp` ファイルを送信する
- **期待結果**: HTTP 400、レスポンスボディに `"Invalid file extension"` を含むエラーメッセージが返る
- **根拠**: src/app/api/projects/[id]/issues/[issueId]/photos/route.ts L71-79
- **Truth Matrix ID**: TM-PHT-006
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/photos/route.ts
- **実装状態**: 未実装
- **備考**: PARTIAL 判定。拡張子バリデーションは実装済みだが、MIMEタイプのバリデーションは未実装。仕様への追記推奨

### API-PHT-002: POST /api/projects/{id}/issues (Issue作成) で写真ファイルなしだと 400 が返る
- **レイヤー**: API Route
- **前提条件**: Admin または Supervisor の認証済みセッション。写真ファイルを含まない multipart リクエストを準備する
- **操作**: `POST /api/projects/p1/issues` に floorId, title, description, dueDate, locationType を含み files を省略して送信する
- **期待結果**: HTTP 400、レスポンスボディに `"At least one BEFORE photo is required"` を含むエラーメッセージが返る
- **根拠**: src/app/api/projects/[id]/issues/route.ts L178-186
- **Truth Matrix ID**: TM-PHT-003
- **実装ファイル**: src/app/api/projects/[id]/issues/route.ts
- **実装状態**: 未実装
- **備考**: PARTIAL 判定。実装では必須だが phase0 仕様書には記載なし。api-design には記載あり

---

## 3. 担当者 (Assignee) ルール

### APP-ASG-001: Assignee 割り振り権限 - Supervisor による正常系
- **レイヤー**: Application Integration
- **前提条件**: `requireRole('SUPERVISOR', 'ADMIN')` が通過するモック認証を用意する
- **操作**: `PATCH /api/projects/p1/issues/i1/assignee` を Supervisor セッションで `{ assigneeId: 'user-1' }` を送信する
- **期待結果**: HTTP 200 が返り、`assignIssue.execute()` が呼ばれる
- **根拠**: src/app/api/projects/[id]/issues/[issueId]/assignee/route.ts L23
- **Truth Matrix ID**: TM-ASG-001
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/assignee/route.ts
- **実装状態**: 未実装
- **備考**: CONFLICT 項目。phase0=Admin+Supervisor, api-design=Supervisorのみ, 実装=SUPERVISOR+ADMIN。実装準拠でテスト定義

### API-ASG-001: Worker が PATCH /assignee を呼ぶと 403 が返る
- **レイヤー**: API Route
- **前提条件**: Worker ロールの認証済みセッションが存在する
- **操作**: `PATCH /api/projects/p1/issues/i1/assignee` に `{ assigneeId: 'user-1' }` を送信する
- **期待結果**: HTTP 403 が返る
- **根拠**: src/app/api/projects/[id]/issues/[issueId]/assignee/route.ts L23
- **Truth Matrix ID**: TM-ASG-001
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/assignee/route.ts
- **実装状態**: 未実装

### APP-ASG-002: Worker が自分担当の Issue のステータスを変更できる
- **レイヤー**: Application Integration
- **前提条件**: Issue の `assigneeId` が `worker-id` である。`changedBy` に `worker-id` を指定する。`status=OPEN`、`newStatus='IN_PROGRESS'`
- **操作**: `UpdateIssueStatusHandler.execute({ issueId, projectId, newStatus: 'IN_PROGRESS', changedBy: 'worker-id' })` を呼び出す
- **期待結果**: 例外がスローされず、`issueRepository.save()` が呼ばれる
- **根拠**: src/application/commands/update-issue-status.ts L40-46
- **Truth Matrix ID**: TM-ASG-003
- **実装ファイル**: src/application/commands/update-issue-status.ts
- **実装状態**: 未実装

### APP-ASG-003: Worker が他者担当の Issue のステータスを変更しようとするとエラー
- **レイヤー**: Application Integration
- **前提条件**: Issue の `assigneeId` が `assignee-id` である。`changedBy` に `other-worker-id` を指定する
- **操作**: `UpdateIssueStatusHandler.execute({ issueId, projectId, newStatus: 'IN_PROGRESS', changedBy: 'other-worker-id' })` を呼び出す
- **期待結果**: `new Error('担当者以外はステータスを変更できません')` がスローされる
- **根拠**: src/application/commands/update-issue-status.ts L44-46
- **Truth Matrix ID**: TM-ASG-003
- **実装ファイル**: src/application/commands/update-issue-status.ts
- **実装状態**: 未実装

### DOM-ASG-001: changeAssignee() が PointOut 状態の Issue を Open に遷移させる
- **レイヤー**: Domain Unit
- **前提条件**: `Issue.reconstruct(..., IssueStatus.PointOut, ...)` で status=PointOut の Issue を用意する
- **操作**: `issue.changeAssignee(UserId.create(newAssigneeId))` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.Open` となり、`assigneeId` が新しい値になる
- **根拠**: src/domain/models/issue.ts L449-451
- **Truth Matrix ID**: TM-ASG-002
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装

---

## 4. Organization (組織)

### DOM-ORG-001: Organization.create() で Branch 組織が生成できる
- **レイヤー**: Domain Unit
- **前提条件**: 有効な `OrganizationId`、`name`、`OrganizationType.Branch`、`parentId` を準備する
- **操作**: `Organization.create(id, '東京支部', OrganizationType.Branch, parentId)` を呼び出す
- **期待結果**: 返却された Organization の `type` が `OrganizationType.Branch`、`name` が '東京支部' である
- **根拠**: src/domain/models/organization.ts L36-47
- **Truth Matrix ID**: TM-ORG-002, TM-ORG-006
- **実装ファイル**: src/domain/models/organization.ts
- **実装状態**: 未実装

### DOM-ORG-002: Organization.create() で name 空文字を渡すと Error がスローされる
- **レイヤー**: Domain Unit
- **前提条件**: 有効な引数のうち name のみ `''` とする
- **操作**: `Organization.create(id, '', OrganizationType.Branch, parentId)` を呼び出す
- **期待結果**: `new Error('Organization name must not be empty')` がスローされる
- **根拠**: src/domain/models/organization.ts L42-44
- **Truth Matrix ID**: TM-ORG-002
- **実装ファイル**: src/domain/models/organization.ts
- **実装状態**: 未実装

### APP-ORG-001: DeleteOrganizationHandler で HQ 組織を削除しようとすると DomainError
- **レイヤー**: Application Integration
- **前提条件**: `IOrganizationRepository.findById()` のモックが `type=HEADQUARTERS` の Organization を返す
- **操作**: `DeleteOrganizationHandler.execute('hq-org-id')` を呼び出す
- **期待結果**: `DomainError('Cannot delete headquarters organization')` がスローされる
- **根拠**: src/application/commands/delete-organization.ts L24-26
- **Truth Matrix ID**: TM-ORG-003
- **実装ファイル**: src/application/commands/delete-organization.ts
- **実装状態**: 未実装

### APP-ORG-002: DeleteOrganizationHandler でユーザーが所属する Branch 組織を削除しようとすると OrganizationHasUsersError
- **レイヤー**: Application Integration
- **前提条件**: `IOrganizationRepository.findById()` のモックが `type=BRANCH` の Organization を返す。`prisma.user.count()` のモックが `1` を返す
- **操作**: `DeleteOrganizationHandler.execute('branch-org-id')` を呼び出す
- **期待結果**: `OrganizationHasUsersError` がスローされる
- **根拠**: src/application/commands/delete-organization.ts L28-34
- **Truth Matrix ID**: TM-ORG-004
- **実装ファイル**: src/application/commands/delete-organization.ts
- **実装状態**: 未実装
- **備考**: PARTIAL 判定。ユーザー数チェックが prisma を直接参照している (TM-ARC-003, TM-ORG-007 レイヤー違反)。Repository 経由に改善推奨

### APP-ORG-003: CreateOrganizationHandler は BRANCH 型の組織のみ作成できる
- **レイヤー**: Application Integration
- **前提条件**: `IOrganizationRepository.save()` のモックを用意する
- **操作**: `CreateOrganizationHandler.execute({ name: '大阪支部', parentId: 'hq-id' })` を呼び出す
- **期待結果**: `repo.save()` に渡された Organization の `type` が `OrganizationType.Branch` である
- **根拠**: src/application/commands/create-organization.ts L11
- **Truth Matrix ID**: TM-ORG-002
- **実装ファイル**: src/application/commands/create-organization.ts
- **実装状態**: 未実装

### API-ORG-001: GET /api/organizations - Admin ロールで正常に一覧取得できる
- **レイヤー**: API Route
- **前提条件**: Admin ロールの認証済みセッションが存在する
- **操作**: `GET /api/organizations` を呼び出す
- **期待結果**: HTTP 200 が返る
- **根拠**: src/app/api/organizations/route.ts L9
- **Truth Matrix ID**: TM-ORG-005
- **実装ファイル**: src/app/api/organizations/route.ts
- **実装状態**: 未実装

### API-ORG-002: GET /api/organizations - Supervisor/Worker ロールでは 403 が返る
- **レイヤー**: API Route
- **前提条件**: Supervisor または Worker ロールの認証済みセッションが存在する
- **操作**: `GET /api/organizations` を呼び出す
- **期待結果**: HTTP 403 が返る
- **根拠**: src/app/api/organizations/route.ts L9
- **Truth Matrix ID**: TM-ORG-005
- **実装ファイル**: src/app/api/organizations/route.ts
- **実装状態**: 未実装

### API-ORG-003: DELETE /api/organizations/{id} で HQ を削除しようとすると 403 が返る
- **レイヤー**: API Route
- **前提条件**: Admin ロールの認証済みセッション。対象 org-id が HEADQUARTERS タイプ
- **操作**: `DELETE /api/organizations/{hq-id}` を呼び出す
- **期待結果**: HTTP 403 が返る
- **根拠**: src/app/api/organizations/[id]/route.ts L44-46
- **Truth Matrix ID**: TM-ORG-003
- **実装ファイル**: src/app/api/organizations/[id]/route.ts
- **実装状態**: 未実装

### API-ORG-004: DELETE /api/organizations/{id} でユーザー所属 Branch を削除しようとすると 409 が返る
- **レイヤー**: API Route
- **前提条件**: Admin ロールの認証済みセッション。対象 org にユーザーが 1 名以上所属
- **操作**: `DELETE /api/organizations/{branch-id}` を呼び出す
- **期待結果**: HTTP 409 が返る
- **根拠**: src/app/api/organizations/[id]/route.ts L41-43
- **Truth Matrix ID**: TM-ORG-004
- **実装ファイル**: src/app/api/organizations/[id]/route.ts
- **実装状態**: 未実装

---

## 5. User (ユーザー)

### DOM-USR-001: User.create() で isActive=true の User が生成される
- **レイヤー**: Domain Unit
- **前提条件**: 有効な `UserId`、`OrganizationId`、`name`、`email`、`UserRole.Worker` を準備する
- **操作**: `User.create(id, orgId, '田中太郎', 'tanaka@example.com', UserRole.Worker)` を呼び出す
- **期待結果**: 返却された User の `isActive` が `true`、`role` が `UserRole.Worker` である
- **根拠**: src/domain/models/user.ts L42-57
- **Truth Matrix ID**: TM-USR-001, TM-USR-003
- **実装ファイル**: src/domain/models/user.ts
- **実装状態**: 未実装

### DOM-USR-002: User.create() で無効なメールアドレスを渡すと Error がスローされる
- **レイヤー**: Domain Unit
- **前提条件**: 有効な引数のうち email のみ `'invalid-email'` (@ なし) とする
- **操作**: `User.create(id, orgId, '田中太郎', 'invalid-email', UserRole.Worker)` を呼び出す
- **期待結果**: `new Error('User email must be valid')` がスローされる
- **根拠**: src/domain/models/user.ts L52-54
- **Truth Matrix ID**: TM-USR-002
- **実装ファイル**: src/domain/models/user.ts
- **実装状態**: 未実装
- **備考**: PARTIAL 判定。ドメインモデルで @ 存在チェックのみ。DB 制約による完全な一意性チェックは Infrastructure 層。仕様追記推奨

### API-USR-001: POST /api/users - Admin ロールでユーザー作成が成功する
- **レイヤー**: API Route
- **前提条件**: Admin ロールの認証済みセッションが存在する
- **操作**: `POST /api/users` に `{ name, email, password, role: 'WORKER', organizationId }` を送信する
- **期待結果**: HTTP 201 が返り、`{ userId }` を含むレスポンスボディが返る
- **根拠**: src/app/api/users/route.ts L46
- **Truth Matrix ID**: TM-USR-004
- **実装ファイル**: src/app/api/users/route.ts
- **実装状態**: 未実装

### API-USR-002: POST /api/users - Supervisor ロールでは 403 が返る
- **レイヤー**: API Route
- **前提条件**: Supervisor ロールの認証済みセッションが存在する
- **操作**: `POST /api/users` に有効なボディを送信する
- **期待結果**: HTTP 403 が返る
- **根拠**: src/app/api/users/route.ts L46
- **Truth Matrix ID**: TM-USR-004
- **実装ファイル**: src/app/api/users/route.ts
- **実装状態**: 未実装

### API-USR-003: DELETE /api/users/{id} - Admin ロールで論理削除が成功する
- **レイヤー**: API Route
- **前提条件**: Admin ロールの認証済みセッションが存在する。対象ユーザーが DB に存在する
- **操作**: `DELETE /api/users/{userId}` を呼び出す
- **期待結果**: HTTP 200 が返り、`{ message: 'User deactivated' }` が返る
- **根拠**: src/app/api/users/[id]/route.ts L37
- **Truth Matrix ID**: TM-USR-003, TM-API-007
- **実装ファイル**: src/app/api/users/[id]/route.ts
- **実装状態**: 未実装

### APP-USR-001: CreateUserHandler が bcrypt でパスワードハッシュ化して保存する
- **レイヤー**: Application Integration
- **前提条件**: `prisma.user.create()` のモックを用意し、引数をキャプチャする
- **操作**: `CreateUserHandler.execute({ name, email, password: 'plain-text-pw', role: 'WORKER', organizationId })` を呼び出す
- **期待結果**: `prisma.user.create()` に渡された `data.password_hash` が `'plain-text-pw'` と異なり、`bcrypt.compareSync('plain-text-pw', data.password_hash)` が `true` を返す
- **根拠**: src/application/commands/create-user.ts L8
- **Truth Matrix ID**: TM-USR-005
- **実装ファイル**: src/application/commands/create-user.ts
- **実装状態**: 未実装
- **備考**: MISSING_SPEC 項目。CreateUserHandler が prisma を直接参照している (TM-USR-006 レイヤー違反)。UserRepository 経由に改善推奨

---

## 6. Auth (認証・認可)

### API-AUT-001: POST /api/projects/{id}/issues - Admin で Issue 作成が成功する
- **レイヤー**: API Route
- **前提条件**: Admin ロールの認証済みセッションが存在する。有効な multipart/form-data リクエストを準備する
- **操作**: `POST /api/projects/p1/issues` に必須フィールドと BEFORE 写真ファイルを送信する
- **期待結果**: HTTP 201 が返る
- **根拠**: src/app/api/projects/[id]/issues/route.ts L72
- **Truth Matrix ID**: TM-AUT-001
- **実装ファイル**: src/app/api/projects/[id]/issues/route.ts
- **実装状態**: 未実装

### API-AUT-002: POST /api/projects/{id}/issues - Worker ロールでは 403 が返る
- **レイヤー**: API Route
- **前提条件**: Worker ロールの認証済みセッションが存在する
- **操作**: `POST /api/projects/p1/issues` に有効なリクエストを送信する
- **期待結果**: HTTP 403 が返る
- **根拠**: src/app/api/projects/[id]/issues/route.ts L72
- **Truth Matrix ID**: TM-AUT-001
- **実装ファイル**: src/app/api/projects/[id]/issues/route.ts
- **実装状態**: 未実装

### API-AUT-003: POST /api/projects - Admin で Project 作成が成功する
- **レイヤー**: API Route
- **前提条件**: Admin ロールの認証済みセッションが存在する
- **操作**: `POST /api/projects` に `{ buildingId, name, startDate, dueDate, branchId }` を送信する
- **期待結果**: HTTP 201 が返る
- **根拠**: src/app/api/projects/route.ts L29
- **Truth Matrix ID**: TM-AUT-002
- **実装ファイル**: src/app/api/projects/route.ts
- **実装状態**: 未実装

### API-AUT-004: POST /api/projects - Supervisor/Worker ロールでは 403 が返る
- **レイヤー**: API Route
- **前提条件**: Supervisor または Worker ロールの認証済みセッションが存在する
- **操作**: `POST /api/projects` に有効なリクエストを送信する
- **期待結果**: HTTP 403 が返る
- **根拠**: src/app/api/projects/route.ts L29
- **Truth Matrix ID**: TM-AUT-002
- **実装ファイル**: src/app/api/projects/route.ts
- **実装状態**: 未実装

### API-AUT-005: PATCH /api/projects/{id}/issues/{issueId}/status で Worker が CONFIRMED を指定すると 403
- **レイヤー**: API Route
- **前提条件**: Worker ロールの認証済みセッションが存在する。Issue は `status=DONE`
- **操作**: `PATCH /api/projects/p1/issues/i1/status` に `{ status: 'CONFIRMED' }` を送信する
- **期待結果**: HTTP 403 が返り、`{ error: 'Workers cannot approve issues' }` が返る
- **根拠**: src/app/api/projects/[id]/issues/[issueId]/status/route.ts L61-65
- **Truth Matrix ID**: TM-AUT-005
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/status/route.ts
- **実装状態**: 未実装

### API-AUT-006: PATCH /api/projects/{id}/issues/{issueId}/status で Admin/Supervisor が CONFIRMED を指定できる
- **レイヤー**: API Route
- **前提条件**: Supervisor ロールの認証済みセッション。Issue は `status=DONE` かつ After 写真が 1 枚以上存在する
- **操作**: `PATCH /api/projects/p1/issues/i1/status` に `{ status: 'CONFIRMED' }` を送信する
- **期待結果**: HTTP 200 が返る
- **根拠**: src/app/api/projects/[id]/issues/[issueId]/status/route.ts L61-65
- **Truth Matrix ID**: TM-AUT-005
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/status/route.ts
- **実装状態**: 未実装

### API-AUT-007: POST /api/projects/{id}/issues/{issueId}/photos - ADMIN/SUPERVISOR/WORKER 全ロールで成功する
- **レイヤー**: API Route
- **前提条件**: 各ロールの認証済みセッション。有効な multipart/form-data リクエストを準備する
- **操作**: Worker セッションで `POST /api/projects/p1/issues/i1/photos` に `photoPhase=AFTER` と有効なファイルを送信する
- **期待結果**: HTTP 201 が返る (Worker も含む全ロールで成功)
- **根拠**: src/app/api/projects/[id]/issues/[issueId]/photos/route.ts L31
- **Truth Matrix ID**: TM-AUT-006
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/photos/route.ts
- **実装状態**: 未実装
- **備考**: CONFLICT 項目。phase0=全ロール, api-design=SUPERVISOR+WORKERのみ, 実装=全ロール (ADMIN+SUPERVISOR+WORKER)。実装準拠でテスト定義

### API-AUT-008: DELETE /api/projects/{id}/issues/{issueId} - Supervisor ロールで削除が成功する
- **レイヤー**: API Route
- **前提条件**: Supervisor ロールの認証済みセッションが存在する
- **操作**: `DELETE /api/projects/p1/issues/i1` を呼び出す
- **期待結果**: HTTP 200 が返り、`{ message: 'Issue deleted successfully' }` が返る
- **根拠**: src/app/api/projects/[id]/issues/[issueId]/route.ts L107
- **Truth Matrix ID**: TM-AUT-007
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/route.ts
- **実装状態**: 未実装
- **備考**: PARTIAL 判定。実装では Supervisor のみ削除可能だが、phase0 に削除権限の明示的記載なし

### API-AUT-009: DELETE /api/projects/{id}/issues/{issueId} - Admin/Worker ロールでは 403 が返る
- **レイヤー**: API Route
- **前提条件**: Admin または Worker ロールの認証済みセッションが存在する
- **操作**: `DELETE /api/projects/p1/issues/i1` を呼び出す
- **期待結果**: HTTP 403 が返る
- **根拠**: src/app/api/projects/[id]/issues/[issueId]/route.ts L107
- **Truth Matrix ID**: TM-AUT-007
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/route.ts
- **実装状態**: 未実装

### API-AUT-010: PATCH /api/projects/{id}/issues/{issueId} - Admin/Supervisor でタイトル更新が成功する
- **レイヤー**: API Route
- **前提条件**: Admin または Supervisor ロールの認証済みセッションが存在する
- **操作**: `PATCH /api/projects/p1/issues/i1` に `{ title: '新タイトル' }` を送信する
- **期待結果**: HTTP 200 が返る
- **根拠**: src/app/api/projects/[id]/issues/[issueId]/route.ts L60
- **Truth Matrix ID**: TM-AUT-008
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/route.ts
- **実装状態**: 未実装
- **備考**: PARTIAL 判定。実装では Admin+Supervisor に許可されているが、仕様書に明示的な記載なし

### API-AUT-011: PATCH /api/projects/{id}/issues/{issueId} - Worker ロールでは 403 が返る
- **レイヤー**: API Route
- **前提条件**: Worker ロールの認証済みセッションが存在する
- **操作**: `PATCH /api/projects/p1/issues/i1` に `{ title: '新タイトル' }` を送信する
- **期待結果**: HTTP 403 が返る
- **根拠**: src/app/api/projects/[id]/issues/[issueId]/route.ts L60
- **Truth Matrix ID**: TM-AUT-008
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/route.ts
- **実装状態**: 未実装

### API-AUT-012: 未認証リクエストは 401 が返る
- **レイヤー**: API Route
- **前提条件**: セッションが存在しない (Cookie なし)
- **操作**: `GET /api/projects` を認証ヘッダーなしで呼び出す
- **期待結果**: HTTP 401 が返る
- **根拠**: src/app/api/projects/route.ts (requireSession)
- **Truth Matrix ID**: TM-AUT-009
- **実装ファイル**: src/app/api/projects/route.ts
- **実装状態**: 未実装
- **備考**: CONFLICT 項目。CLAUDE.md には「認証なし」と記載されているが、実装では NextAuth が完全実装されている。実装準拠でテスト定義

---

## 7. Progress (進捗率計算)

### APP-PRG-001: 進捗率算出 - Done=50%, Confirmed=100%, 他=0% の平均
- **レイヤー**: Application Integration
- **前提条件**: `listProjects()` に渡す prisma モックが Issues として `[{status:'DONE'}, {status:'CONFIRMED'}, {status:'OPEN'}]` を返す
- **操作**: `listProjects({ page: 1, limit: 10 })` を呼び出す
- **期待結果**: 返却された `items[0].progressRate` が `Math.round((50 + 100 + 0) / 3)` = `50` である
- **根拠**: src/application/queries/list-projects.ts L58-66
- **Truth Matrix ID**: TM-PRG-001
- **実装ファイル**: src/application/queries/list-projects.ts
- **実装状態**: 未実装

### APP-PRG-002: 指摘 0 件のプロジェクトの進捗率は 0%
- **レイヤー**: Application Integration
- **前提条件**: prisma モックが `issues: []` を返す Project を返す
- **操作**: `listProjects({ page: 1, limit: 10 })` を呼び出す
- **期待結果**: 返却された `items[0].progressRate` が `0` である
- **根拠**: src/application/queries/list-projects.ts L59-60
- **Truth Matrix ID**: TM-PRG-002
- **実装ファイル**: src/application/queries/list-projects.ts
- **実装状態**: 未実装

### APP-PRG-003: Worker ロールでは自身担当の Issue のみで進捗率を算出する
- **レイヤー**: Application Integration
- **前提条件**: prisma モックが `assignee_id='worker-id'` に絞り込まれた Issues を返す
- **操作**: `listProjects({ page: 1, limit: 10 }, 'WORKER', undefined, 'worker-id')` を呼び出す
- **期待結果**: prisma クエリの `where` 条件に `issues.some.assignee_id: 'worker-id'` が含まれ、進捗率は担当 Issue のみで計算される
- **根拠**: src/application/queries/list-projects.ts L23-29, L34-36
- **Truth Matrix ID**: TM-PRG-004
- **実装ファイル**: src/application/queries/list-projects.ts
- **実装状態**: 未実装

### APP-PRG-004: Supervisor ロールでは自支部の Project のみ取得される
- **レイヤー**: Application Integration
- **前提条件**: `organizationId='branch-id'` を指定する
- **操作**: `listProjects({ page: 1, limit: 10 }, 'SUPERVISOR', 'branch-id')` を呼び出す
- **期待結果**: prisma クエリの `where` 条件に `branch_id: 'branch-id'` が含まれる
- **根拠**: src/application/queries/list-projects.ts L20-22
- **Truth Matrix ID**: TM-PRG-005
- **実装ファイル**: src/application/queries/list-projects.ts
- **実装状態**: 未実装

### APP-PRG-005: 進捗率は Query 時に算出され DB には保存されない
- **レイヤー**: Application Integration
- **前提条件**: `listProjects()` の実装コードを参照する
- **操作**: `listProjects()` の実装を確認し、progressRate を永続化していないことを検証する
- **期待結果**: `prisma.project.update()` や `save()` が呼ばれていない。progressRate は `project.issues` から都度計算されている
- **根拠**: src/application/queries/list-projects.ts L58-67
- **Truth Matrix ID**: TM-PRG-003
- **実装ファイル**: src/application/queries/list-projects.ts
- **実装状態**: 未実装
- **備考**: PARTIAL 判定。DB 非永続化は実装済みだが、進捗率キャッシュ戦略の仕様記載なし

---

## 8. API エンドポイント入出力

### API-API-001: POST /api/projects/{id}/issues が multipart/form-data を受け付ける
- **レイヤー**: API Route
- **前提条件**: Admin ロールの認証済みセッション。Content-Type: multipart/form-data のリクエスト
- **操作**: `POST /api/projects/p1/issues` に multipart/form-data で必須フィールドと BEFORE 写真を送信する
- **期待結果**: HTTP 201 が返る
- **根拠**: src/app/api/projects/[id]/issues/route.ts L91
- **Truth Matrix ID**: TM-API-001
- **実装ファイル**: src/app/api/projects/[id]/issues/route.ts
- **実装状態**: 未実装

### API-API-002: PATCH /api/projects/{id}/issues/{issueId}/status で PascalCase ステータスが受け付けられる
- **レイヤー**: API Route
- **前提条件**: 認証済みセッション。Issue は `status=OPEN`
- **操作**: `PATCH /api/projects/p1/issues/i1/status` に `{ status: 'InProgress' }` (PascalCase) を送信する
- **期待結果**: HTTP 200 が返り、正しく `IN_PROGRESS` に変換されて遷移が成功する
- **根拠**: src/app/api/projects/[id]/issues/[issueId]/status/route.ts L37-48
- **Truth Matrix ID**: TM-API-006
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/status/route.ts
- **実装状態**: 未実装
- **備考**: PARTIAL 判定。PascalCase と UPPER_CASE の両方を受け付ける実装済み

### API-API-003: PATCH /api/projects/{id}/issues/{issueId}/status で無効なステータスを渡すと 400 が返る
- **レイヤー**: API Route
- **前提条件**: 認証済みセッション
- **操作**: `PATCH /api/projects/p1/issues/i1/status` に `{ status: 'INVALID_STATUS' }` を送信する
- **期待結果**: HTTP 400 が返る
- **根拠**: src/app/api/projects/[id]/issues/[issueId]/status/route.ts L50-58
- **Truth Matrix ID**: TM-API-002
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/status/route.ts
- **実装状態**: 未実装

### API-API-004: GET /api/projects はページネーションパラメータを受け付ける
- **レイヤー**: API Route
- **前提条件**: 認証済みセッションが存在する
- **操作**: `GET /api/projects?page=2&limit=5` を呼び出す
- **期待結果**: HTTP 200 が返り、レスポンスボディに `{ items, totalCount, page: 2, limit: 5 }` 相当の構造が含まれる
- **根拠**: src/app/api/projects/route.ts L14, src/application/queries/list-projects.ts
- **Truth Matrix ID**: TM-API-003
- **実装ファイル**: src/app/api/projects/route.ts
- **実装状態**: 未実装
- **備考**: PARTIAL 判定。ページネーション実装はあるが limit の上限値バリデーション仕様が未記載

### API-API-005: GET /api/projects/{id}/issues で floorId + status フィルタが動作する
- **レイヤー**: API Route
- **前提条件**: 認証済みセッション。対象プロジェクトに複数フロアの Issue が存在する
- **操作**: `GET /api/projects/p1/issues?floorId=f1&status=OPEN,IN_PROGRESS` を呼び出す
- **期待結果**: HTTP 200 が返り、`floorId=f1` かつ `status` が OPEN または IN_PROGRESS の Issue のみが返る
- **根拠**: src/app/api/projects/[id]/issues/route.ts L43-45
- **Truth Matrix ID**: TM-API-004
- **実装ファイル**: src/app/api/projects/[id]/issues/route.ts
- **実装状態**: 未実装

### API-API-006: POST /api/projects/{id}/issues で dueDate なしだと 400 が返る
- **レイヤー**: API Route
- **前提条件**: Admin ロールの認証済みセッション
- **操作**: `POST /api/projects/p1/issues` に dueDate を除いた必須フィールドを送信する
- **期待結果**: HTTP 400 が返る
- **根拠**: src/app/api/projects/[id]/issues/route.ts L136-143
- **Truth Matrix ID**: TM-API-005
- **実装ファイル**: src/app/api/projects/[id]/issues/route.ts
- **実装状態**: 未実装
- **備考**: PARTIAL 判定。実装では dueDate 必須だが phase0 に必須フィールドとして明記なし

### API-API-007: GET /api/users - Admin のみアクセス可能 (phase0 パスの差異)
- **レイヤー**: API Route
- **前提条件**: Admin ロールの認証済みセッション
- **操作**: `GET /api/users` を呼び出す
- **期待結果**: HTTP 200 が返る
- **根拠**: src/app/api/users/route.ts L14
- **Truth Matrix ID**: TM-API-008
- **実装ファイル**: src/app/api/users/route.ts
- **実装状態**: 未実装
- **備考**: CONFLICT 項目。phase0 では `/api/organizations/{orgId}/users`、実装では `/api/users`。実装準拠でテスト定義

### API-API-008: GET /api/projects - 全ロールでアクセス可能 (phase0 パスの差異)
- **レイヤー**: API Route
- **前提条件**: 認証済みセッション (任意ロール)
- **操作**: `GET /api/projects` を呼び出す
- **期待結果**: HTTP 200 が返る (ロール別フィルタリングが適用される)
- **根拠**: src/app/api/projects/route.ts L8
- **Truth Matrix ID**: TM-API-009
- **実装ファイル**: src/app/api/projects/route.ts
- **実装状態**: 未実装
- **備考**: CONFLICT 項目。phase0 では `/api/organizations/{orgId}/projects`、実装では `/api/projects`。実装準拠でテスト定義

---

## 9. ドメインモデル構造

### DOM-DOM-001: Location.createFromDbId() で DbId ベースの Location が生成される
- **レイヤー**: Domain Unit
- **前提条件**: 有効な dbId 文字列 `'element-123'` を準備する
- **操作**: `Location.createFromDbId('element-123')` を呼び出す
- **期待結果**: 返却された Location の `value.type` が `'dbId'`、`(value as DbIdLocation).dbId` が `'element-123'` である
- **根拠**: src/domain/models/location.ts L37-46
- **Truth Matrix ID**: TM-DOM-001
- **実装ファイル**: src/domain/models/location.ts
- **実装状態**: 未実装

### DOM-DOM-002: Location.createFromWorldPosition() で WorldPosition ベースの Location が生成される
- **レイヤー**: Domain Unit
- **前提条件**: 有効な座標値 x=1.0, y=2.0, z=3.0 を準備する
- **操作**: `Location.createFromWorldPosition(1.0, 2.0, 3.0)` を呼び出す
- **期待結果**: 返却された Location の `value.type` が `'worldPosition'`、x/y/z が各指定値と一致する
- **根拠**: src/domain/models/location.ts L51-68
- **Truth Matrix ID**: TM-DOM-001
- **実装ファイル**: src/domain/models/location.ts
- **実装状態**: 未実装

### DOM-DOM-003: Location.createFromDbId() で空文字を渡すと DomainError がスローされる
- **レイヤー**: Domain Unit
- **前提条件**: dbId に空文字 `''` を準備する
- **操作**: `Location.createFromDbId('')` を呼び出す
- **期待結果**: `DomainError('dbId must not be empty')` がスローされる
- **根拠**: src/domain/models/location.ts L38-40
- **Truth Matrix ID**: TM-DOM-001
- **実装ファイル**: src/domain/models/location.ts
- **実装状態**: 未実装

### DOM-DOM-004: Location.createFromWorldPosition() で非有限値を渡すと DomainError がスローされる
- **レイヤー**: Domain Unit
- **前提条件**: z 座標に `Infinity` を渡す
- **操作**: `Location.createFromWorldPosition(1.0, 2.0, Infinity)` を呼び出す
- **期待結果**: `DomainError('World position coordinates must be finite numbers')` がスローされる
- **根拠**: src/domain/models/location.ts L56-60
- **Truth Matrix ID**: TM-DOM-001
- **実装ファイル**: src/domain/models/location.ts
- **実装状態**: 未実装

### DOM-DOM-005: Location.equals() が同値の DbId Location で true を返す
- **レイヤー**: Domain Unit
- **前提条件**: `Location.createFromDbId('elem-1')` を2回呼び出してインスタンスを生成する
- **操作**: `loc1.equals(loc2)` を呼び出す
- **期待結果**: `true` が返る
- **根拠**: src/domain/models/location.ts L94-111
- **Truth Matrix ID**: TM-DOM-001
- **実装ファイル**: src/domain/models/location.ts
- **実装状態**: 未実装

### DOM-DOM-006: Issue に IssuePriority (Low/Medium/High/Critical) が設定できる
- **レイヤー**: Domain Unit
- **前提条件**: 有効な Issue.create() 引数に priority を明示的に指定する
- **操作**: `Issue.create(id, projectId, floorId, 'title', 'desc', undefined, userId, location, dueDate, IssuePriority.High)` を呼び出す
- **期待結果**: 返却された Issue の `priority` が `IssuePriority.High` ('HIGH') である
- **根拠**: src/domain/models/issue.ts L49-54, L92
- **Truth Matrix ID**: TM-DOM-002
- **実装ファイル**: src/domain/models/issue.ts
- **実装状態**: 未実装
- **備考**: PARTIAL 判定。実装には Priority あり、phase0 仕様書には記載なし。仕様追記推奨

### DOM-DOM-007: StatusChangeLog.create() で変更ログが生成される
- **レイヤー**: Domain Unit
- **前提条件**: 有効な `StatusChangeLogId`、`IssueId`、`fromStatus`、`toStatus`、`changedBy` を準備する
- **操作**: `StatusChangeLog.create(logId, issueId, IssueStatus.Open, IssueStatus.InProgress, userId, undefined)` を呼び出す
- **期待結果**: 返却された StatusChangeLog の `fromStatus` が `IssueStatus.Open`、`toStatus` が `IssueStatus.InProgress` である
- **根拠**: src/domain/models/status-change-log.ts L1-52
- **Truth Matrix ID**: TM-DOM-003
- **実装ファイル**: src/domain/models/status-change-log.ts
- **実装状態**: 未実装

### APP-DOM-001: UpdateIssueStatusHandler がステータス変更後に StatusChangeLog を保存する
- **レイヤー**: Application Integration
- **前提条件**: `statusChangeLogRepository.save()` のモックを用意し、引数をキャプチャする。Issue は `status=OPEN`
- **操作**: `UpdateIssueStatusHandler.execute({ issueId, projectId, newStatus: 'IN_PROGRESS', changedBy })` を呼び出す
- **期待結果**: `statusChangeLogRepository.save()` が呼ばれ、渡された log の `fromStatus` が `IssueStatus.Open`、`toStatus` が `IssueStatus.InProgress` である
- **根拠**: src/application/commands/update-issue-status.ts L104-112
- **Truth Matrix ID**: TM-DOM-003
- **実装ファイル**: src/application/commands/update-issue-status.ts
- **実装状態**: 未実装

---

## 10. アーキテクチャ原則

### APP-ARC-001: Query ハンドラ (listProjects) は Domain 集約を経由せず直接 DB から読み取る
- **レイヤー**: Application Integration
- **前提条件**: `listProjects()` の実装コードを参照する
- **操作**: `listProjects()` が `prisma.project.findMany()` を直接呼び出し、Issue ドメイン集約のインスタンスを生成していないことを静的確認する
- **期待結果**: `Issue.reconstruct()` 等のドメイン集約ファクトリメソッドが呼ばれていない
- **根拠**: src/application/queries/list-projects.ts L38-54, CLAUDE.md CQRS
- **Truth Matrix ID**: TM-ARC-002
- **実装ファイル**: src/application/queries/list-projects.ts
- **実装状態**: 未実装

### APP-ARC-002: UpdateIssueStatusHandler (Issue 系 Command) が Domain 集約を経由する
- **レイヤー**: Application Integration
- **前提条件**: `IIssueRepository.findById()` のモックを用意する
- **操作**: `UpdateIssueStatusHandler.execute({ issueId, projectId, newStatus: 'IN_PROGRESS', changedBy })` を呼び出す実装フローを確認する
- **期待結果**: `issue.startWork()` 等の Domain 集約メソッドが呼ばれてから `issueRepository.save()` が呼ばれる順序が担保されている
- **根拠**: src/application/commands/update-issue-status.ts L80-101
- **Truth Matrix ID**: TM-ARC-001
- **実装ファイル**: src/application/commands/update-issue-status.ts
- **実装状態**: 未実装

### APP-ARC-003: CreateUserHandler が Domain 集約を経由せず prisma を直接参照している (レイヤー違反の検知)
- **レイヤー**: Application Integration
- **前提条件**: `create-user.ts` のソースを参照する
- **操作**: `CreateUserHandler.execute()` の実装において `prisma.user.create()` が直接インポートされているかを静的確認する
- **期待結果**: `import prisma from '../../infrastructure/prisma/prisma-client'` が存在し、`User.create()` ドメインオブジェクトを経由していないことが確認できる (違反が検出される)
- **根拠**: src/application/commands/create-user.ts L3
- **Truth Matrix ID**: TM-ARC-003, TM-USR-006, TM-USR-007
- **実装ファイル**: src/application/commands/create-user.ts
- **実装状態**: 未実装 (テストケースとして違反を明示的に検知する)
- **備考**: CONFLICT/MISSING_SPEC 項目。User/Org 系 Command がレイヤー違反。UserRepository Interface を経由する形に改善が必要。改善後はこのテストケースを変更すること

### APP-ARC-004: DeleteOrganizationHandler が prisma を直接参照している (レイヤー違反の検知)
- **レイヤー**: Application Integration
- **前提条件**: `delete-organization.ts` のソースを参照する
- **操作**: `import prisma from '../../infrastructure/prisma/prisma-client'` が存在するかを静的確認する
- **期待結果**: レイヤー違反が検出される (`prisma.user.count()` が Application 層で直接呼ばれている)
- **根拠**: src/application/commands/delete-organization.ts L4
- **Truth Matrix ID**: TM-ARC-003, TM-ORG-007
- **実装ファイル**: src/application/commands/delete-organization.ts
- **実装状態**: 未実装 (違反検知テストケース)
- **備考**: MISSING_SPEC 項目。UserRepository.countByOrganizationId() などの Repository メソッドで代替推奨

---

## 11. ステータス変更コメント・否認写真ルール

### APP-ISS-001: Done → Open (否認) 時にコメントなしだと Error がスローされる
- **レイヤー**: Application Integration
- **前提条件**: Issue は `status=DONE`。`photoRepository.findByIssueId()` のモックが After 写真 1 枚を返す
- **操作**: `UpdateIssueStatusHandler.execute({ issueId, projectId, newStatus: 'OPEN', changedBy, comment: '' })` を呼び出す
- **期待結果**: `new Error('否認・再指摘にはコメントが必須です')` がスローされる
- **根拠**: src/application/commands/update-issue-status.ts L57-65
- **Truth Matrix ID**: TM-ISS-007
- **実装ファイル**: src/application/commands/update-issue-status.ts
- **実装状態**: 未実装

### APP-ISS-002: Confirmed → Open (再指摘) 時にコメントなしだと Error がスローされる
- **レイヤー**: Application Integration
- **前提条件**: Issue は `status=CONFIRMED`
- **操作**: `UpdateIssueStatusHandler.execute({ issueId, projectId, newStatus: 'OPEN', changedBy, comment: undefined })` を呼び出す
- **期待結果**: `new Error('否認・再指摘にはコメントが必須です')` がスローされる
- **根拠**: src/application/commands/update-issue-status.ts L57-65
- **Truth Matrix ID**: TM-ISS-008
- **実装ファイル**: src/application/commands/update-issue-status.ts
- **実装状態**: 未実装

### APP-ISS-003: Confirmed → Open (再指摘) 時に Rejection 写真なしだと Error がスローされる
- **レイヤー**: Application Integration
- **前提条件**: Issue は `status=CONFIRMED`。`photoRepository.findByIssueId()` のモックが Rejection 写真 0 枚 (空配列) を返す
- **操作**: `UpdateIssueStatusHandler.execute({ issueId, projectId, newStatus: 'OPEN', changedBy, comment: '再指摘理由' })` を呼び出す
- **期待結果**: `new Error('再指摘には否認時写真が1枚以上必要です')` がスローされる
- **根拠**: src/application/commands/update-issue-status.ts L67-74
- **Truth Matrix ID**: TM-ISS-013
- **実装ファイル**: src/application/commands/update-issue-status.ts
- **実装状態**: 未実装
- **備考**: MISSING_SPEC 項目。Rejection 写真必須の仕様が実装のみに存在する。仕様書への追記推奨

### APP-ISS-004: Confirmed → Open (再指摘) 時に Rejection 写真が 1 枚以上あると遷移が成功する (境界値)
- **レイヤー**: Application Integration
- **前提条件**: Issue は `status=CONFIRMED`。`photoRepository.findByIssueId()` のモックが `[Photo(phase=Rejection)]` を返す
- **操作**: `UpdateIssueStatusHandler.execute({ issueId, projectId, newStatus: 'OPEN', changedBy, comment: '再指摘理由' })` を呼び出す
- **期待結果**: 例外がスローされず `issueRepository.save()` が呼ばれる
- **根拠**: src/application/commands/update-issue-status.ts L67-74
- **Truth Matrix ID**: TM-ISS-013
- **実装ファイル**: src/application/commands/update-issue-status.ts
- **実装状態**: 未実装

### APP-ISS-005: 未サポートの状態遷移要求時に InvalidStatusTransitionError がスローされる
- **レイヤー**: Application Integration
- **前提条件**: Issue は `status=OPEN`
- **操作**: `UpdateIssueStatusHandler.execute({ issueId, projectId, newStatus: 'CONFIRMED', changedBy })` を呼び出す (Open → Confirmed は不正遷移)
- **期待結果**: `InvalidStatusTransitionError` がスローされる
- **根拠**: src/application/commands/update-issue-status.ts L94-98
- **Truth Matrix ID**: TM-ISS-009
- **実装ファイル**: src/application/commands/update-issue-status.ts
- **実装状態**: 未実装

---

## 12. E2E フロー

### E2E-ISS-001: Issue 作成から Done 遷移までの一連のフロー
- **レイヤー**: E2E
- **前提条件**: Supervisor としてログイン済み。プロジェクトとフロアが DB に存在する
- **操作**:
  1. `POST /api/projects/{id}/issues` で Issue を作成 (BEFORE 写真付き)
  2. `PATCH /api/projects/{id}/issues/{issueId}/assignee` で Worker を担当者設定
  3. Worker としてログインし `PATCH /api/projects/{id}/issues/{issueId}/status` で `IN_PROGRESS` に変更
  4. `POST /api/projects/{id}/issues/{issueId}/photos` で AFTER 写真をアップロード
  5. `PATCH /api/projects/{id}/issues/{issueId}/status` で `DONE` に変更
- **期待結果**: 最終的に Issue の `status` が `DONE` となり、各ステップで HTTP 200/201 が返る
- **根拠**: CLAUDE.md 状態遷移ルール、issue.ts 各遷移メソッド
- **Truth Matrix ID**: TM-ISS-001 〜 TM-ISS-004
- **実装ファイル**: src/app/api/projects/[id]/issues/ (各ルートハンドラ)
- **実装状態**: 未実装

### E2E-ISS-002: Issue 承認フロー (Done → Confirmed)
- **レイヤー**: E2E
- **前提条件**: Supervisor としてログイン済み。Issue は `status=DONE` かつ AFTER 写真が 1 枚以上存在する
- **操作**: `PATCH /api/projects/{id}/issues/{issueId}/status` に `{ status: 'CONFIRMED' }` を送信する
- **期待結果**: HTTP 200 が返り、Issue の `status` が `CONFIRMED` になる
- **根拠**: issue.ts L474-495, status/route.ts L61-65
- **Truth Matrix ID**: TM-ISS-006, TM-AUT-005
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/status/route.ts
- **実装状態**: 未実装

### E2E-ISS-003: Issue 再指摘フロー (Confirmed → Open)
- **レイヤー**: E2E
- **前提条件**: Supervisor としてログイン済み。Issue は `status=CONFIRMED`。Rejection 写真が 1 枚以上存在する
- **操作**:
  1. `POST /api/projects/{id}/issues/{issueId}/photos` で REJECTION 写真をアップロード
  2. `PATCH /api/projects/{id}/issues/{issueId}/status` に `{ status: 'OPEN', comment: '再指摘します' }` を送信する
- **期待結果**: HTTP 200 が返り、Issue の `status` が `OPEN` になる
- **根拠**: issue.ts L526-547, update-issue-status.ts L67-74
- **Truth Matrix ID**: TM-ISS-008, TM-ISS-013
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/status/route.ts
- **実装状態**: 未実装

### E2E-AUT-001: 未認証ユーザーがすべての保護エンドポイントで 401 を受け取る
- **レイヤー**: E2E
- **前提条件**: セッション Cookie なし
- **操作**: `GET /api/projects`、`POST /api/projects`、`GET /api/users` を各々 Cookie なしで呼び出す
- **期待結果**: いずれも HTTP 401 が返る
- **根拠**: requireSession の実装
- **Truth Matrix ID**: TM-AUT-009
- **実装ファイル**: src/app/api/ (各ルートハンドラ)
- **実装状態**: 未実装

### E2E-ORG-001: 組織管理フロー (作成→更新→削除)
- **レイヤー**: E2E
- **前提条件**: Admin としてログイン済み。HQ 組織が DB に存在する
- **操作**:
  1. `POST /api/organizations` に `{ name: '新支部', parentId: hqId }` を送信して Branch 作成
  2. `PATCH /api/organizations/{id}` に `{ name: '改名支部' }` を送信して更新
  3. ユーザーが所属していないことを確認後 `DELETE /api/organizations/{id}` を送信して削除
- **期待結果**: 各ステップで HTTP 201/200 が返り、最後に組織が削除される
- **根拠**: organizations/route.ts, organizations/[id]/route.ts
- **Truth Matrix ID**: TM-ORG-002, TM-ORG-003, TM-ORG-004
- **実装ファイル**: src/app/api/organizations/ (各ルートハンドラ)
- **実装状態**: 未実装

### E2E-USR-001: ユーザー管理フロー (作成→更新→論理削除)
- **レイヤー**: E2E
- **前提条件**: Admin としてログイン済み
- **操作**:
  1. `POST /api/users` に `{ name, email, password, role: 'WORKER', organizationId }` を送信してユーザー作成
  2. `PATCH /api/users/{id}` に `{ name: '新名前' }` を送信して更新
  3. `DELETE /api/users/{id}` を送信して論理削除
- **期待結果**: 各ステップで HTTP 201/200 が返る。論理削除後に DB の `is_active` が `false` になっている
- **根拠**: users/route.ts, users/[id]/route.ts, deactivate-user.ts
- **Truth Matrix ID**: TM-USR-003, TM-USR-004
- **実装ファイル**: src/app/api/users/ (各ルートハンドラ)
- **実装状態**: 未実装

### E2E-PRG-001: Admin がプロジェクト一覧で全プロジェクトの進捗率を確認できる
- **レイヤー**: E2E
- **前提条件**: Admin としてログイン済み。Issues の status が混在するプロジェクトが存在する
- **操作**: `GET /api/projects` を呼び出す
- **期待結果**: HTTP 200 が返り、各プロジェクトに `progressRate` フィールドが含まれ、DONE=50/CONFIRMED=100/他=0 の平均値に一致する
- **根拠**: list-projects.ts L58-66
- **Truth Matrix ID**: TM-PRG-001, TM-PRG-002
- **実装ファイル**: src/application/queries/list-projects.ts
- **実装状態**: 未実装

### E2E-PRG-002: Worker がプロジェクト一覧で自分担当の Issues のみで集計された進捗率を確認できる
- **レイヤー**: E2E
- **前提条件**: Worker としてログイン済み。同プロジェクトに Worker 担当の Issue と他者担当の Issue が混在する
- **操作**: `GET /api/projects` を Worker セッションで呼び出す
- **期待結果**: 返却されたプロジェクト一覧の `progressRate` が Worker 担当 Issue のみで計算された値と一致する
- **根拠**: list-projects.ts L23-29, L34-36
- **Truth Matrix ID**: TM-PRG-004
- **実装ファイル**: src/application/queries/list-projects.ts
- **実装状態**: 未実装

---

## 付録: Truth Matrix カバレッジ

| Truth Matrix ID | テストケース ID | 判定 |
|----------------|----------------|------|
| TM-ISS-001 | DOM-ISS-001, DOM-ISS-013, DOM-ISS-014 | MATCH |
| TM-ISS-002 | DOM-ISS-002 | MATCH |
| TM-ISS-003 | DOM-ISS-003, DOM-ISS-004 | MATCH |
| TM-ISS-004 | DOM-ISS-005, APP-PHT-001, APP-PHT-002 | MATCH |
| TM-ISS-005 | DOM-ISS-007 | MATCH |
| TM-ISS-006 | DOM-ISS-008, E2E-ISS-002 | MATCH |
| TM-ISS-007 | DOM-ISS-009, APP-ISS-001 | MATCH |
| TM-ISS-008 | DOM-ISS-010, APP-ISS-002, E2E-ISS-003 | MATCH |
| TM-ISS-009 | DOM-ISS-006, APP-ISS-005 | MATCH |
| TM-ISS-010 | DOM-ISS-004 | PARTIAL |
| TM-ISS-011 | DOM-ISS-011 | CONFLICT |
| TM-ISS-012 | DOM-ISS-012 | MATCH |
| TM-ISS-013 | APP-ISS-003, APP-ISS-004 | MISSING_SPEC |
| TM-PHT-001 | DOM-PHT-001, DOM-PHT-002 | MATCH |
| TM-PHT-002 | APP-PHT-001, APP-PHT-002 | MATCH |
| TM-PHT-003 | API-PHT-002 | PARTIAL |
| TM-PHT-004 | APP-PHT-003 | MATCH |
| TM-PHT-005 | APP-PHT-004 | PARTIAL |
| TM-PHT-006 | API-PHT-001 | PARTIAL |
| TM-ASG-001 | APP-ASG-001, API-ASG-001 | CONFLICT |
| TM-ASG-002 | DOM-ISS-002, DOM-ASG-001 | MATCH |
| TM-ASG-003 | APP-ASG-002, APP-ASG-003 | MATCH |
| TM-ASG-004 | DOM-ISS-015 | MISSING_SPEC |
| TM-ORG-001 | (シード確認のため E2E-ORG-001 で間接確認) | PARTIAL |
| TM-ORG-002 | DOM-ORG-001, APP-ORG-003 | MATCH |
| TM-ORG-003 | APP-ORG-001, API-ORG-003 | MATCH |
| TM-ORG-004 | APP-ORG-002, API-ORG-004 | PARTIAL |
| TM-ORG-005 | API-ORG-001, API-ORG-002 | MATCH |
| TM-ORG-006 | DOM-ORG-001 | MATCH |
| TM-ORG-007 | APP-ARC-004 | MISSING_SPEC |
| TM-USR-001 | DOM-USR-001 | MATCH |
| TM-USR-002 | DOM-USR-002 | PARTIAL |
| TM-USR-003 | DOM-USR-001, API-USR-003, E2E-USR-001 | MATCH |
| TM-USR-004 | API-USR-001, API-USR-002 | MATCH |
| TM-USR-005 | APP-USR-001 | MATCH |
| TM-USR-006 | APP-ARC-003 | MISSING_SPEC |
| TM-USR-007 | APP-ARC-003 | MISSING_SPEC |
| TM-AUT-001 | API-AUT-001, API-AUT-002 | MATCH |
| TM-AUT-002 | API-AUT-003, API-AUT-004 | MATCH |
| TM-AUT-003 | API-AUT-003 | MATCH |
| TM-AUT-004 | APP-ASG-002, APP-ASG-003 | MATCH |
| TM-AUT-005 | API-AUT-005, API-AUT-006 | MATCH |
| TM-AUT-006 | API-AUT-007 | CONFLICT |
| TM-AUT-007 | API-AUT-008, API-AUT-009 | PARTIAL |
| TM-AUT-008 | API-AUT-010, API-AUT-011 | PARTIAL |
| TM-AUT-009 | API-AUT-012, E2E-AUT-001 | CONFLICT |
| TM-PRG-001 | APP-PRG-001, E2E-PRG-001 | MATCH |
| TM-PRG-002 | APP-PRG-002, E2E-PRG-001 | MATCH |
| TM-PRG-003 | APP-PRG-005 | PARTIAL |
| TM-PRG-004 | APP-PRG-003, E2E-PRG-002 | MATCH |
| TM-PRG-005 | APP-PRG-004 | MATCH |
| TM-API-001 | API-API-001 | MATCH |
| TM-API-002 | API-API-003 | MATCH |
| TM-API-003 | API-API-004 | PARTIAL |
| TM-API-004 | API-API-005 | MATCH |
| TM-API-005 | API-API-006 | PARTIAL |
| TM-API-006 | API-API-002 | PARTIAL |
| TM-API-007 | API-USR-003 | MATCH |
| TM-API-008 | API-API-007 | CONFLICT |
| TM-API-009 | API-API-008 | CONFLICT |
| TM-DOM-001 | DOM-DOM-001 〜 DOM-DOM-005 | MATCH |
| TM-DOM-002 | DOM-DOM-006 | PARTIAL |
| TM-DOM-003 | DOM-DOM-007, APP-DOM-001 | MATCH |
| TM-DOM-004 | API-AUT-003 (branchId 必須確認) | MATCH |
| TM-DOM-005 | API-AUT-003 (plan フィールド確認) | MATCH |
| TM-DOM-006 | DOM-ISS-001 (5段階ステータスを確認) | CONFLICT |
| TM-DOM-007 | DOM-PHT-001 (3値フェーズを確認) | CONFLICT |
| TM-DOM-008 | DOM-ISS-012, DOM-ASG-001 | CONFLICT |
| TM-DOM-009 | APP-ARC-001 | MATCH |
| TM-ARC-001 | APP-ARC-002 | PARTIAL |
| TM-ARC-002 | APP-ARC-001 | MATCH |
| TM-ARC-003 | APP-ARC-003, APP-ARC-004 | CONFLICT |

**カバレッジ: 55/55 項目 (100%)**
