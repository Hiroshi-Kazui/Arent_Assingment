# テスト仕様書

生成日時: 2026-03-09 14:00
対象スコープ: 全体
Truth Matrix基準: 2026-03-09 (全体 93項目 + APIエンドポイント34件)

## サマリー
- 総テストケース数: 129
- Domain Unit: 32件
- Application Integration: 27件
- API Route: 58件
- E2E: 12件

---

## 1. Issue 状態遷移

### DOM-ISS-001: Issue.create() でステータスが POINT_OUT で生成される
- **レイヤー**: Domain Unit
- **前提条件**: `IssueId.create('issue-001')`, `ProjectId.create('project-001')`, `FloorId.create('floor-001')`, `UserId.create('user-001')`, `Location.createFromDbId('elem-001')` を準備する
- **操作**: `Issue.create(issueId, projectId, floorId, 'タイトル', '説明', IssueType.Quality, userId, location, new Date('2026-12-31'))` を呼び出す
- **期待結果**: 返却された Issue インスタンスの `status` が `IssueStatus.PointOut` ('POINT_OUT') である
- **根拠**: CLAUDE.md 状態遷移ルール / docs/phase0_plan.md §0.5
- **Truth Matrix ID**: TM-ISS-001, TM-ISS-011
- **実装ファイル**: src/domain/models/issue.test.ts L52-74
- **実装状態**: 実装済み

### DOM-ISS-002: Issue.create() でタイトルが空文字の場合 Error がスローされる
- **レイヤー**: Domain Unit
- **前提条件**: 同上のID群を準備する
- **操作**: `Issue.create(issueId, projectId, floorId, '', '説明', undefined, userId, location, new Date('2026-12-31'))` を呼び出す
- **期待結果**: `'Issue title must not be empty'` を含む Error がスローされる
- **根拠**: CLAUDE.md コーディング規約（バリデーション）
- **Truth Matrix ID**: TM-DOM-004
- **実装ファイル**: src/domain/models/issue.test.ts L77-88
- **実装状態**: 実装済み

### DOM-ISS-003: Issue.create() で無効な dueDate を渡すと Error がスローされる
- **レイヤー**: Domain Unit
- **前提条件**: 同上のID群を準備する
- **操作**: `Issue.create(issueId, projectId, floorId, 'タイトル', '説明', undefined, userId, location, new Date('invalid'))` を呼び出す
- **期待結果**: `'Issue dueDate is invalid'` を含む Error がスローされる
- **根拠**: docs/phase0_plan.md（dueDate バリデーション）
- **Truth Matrix ID**: TM-PRJ-004
- **実装ファイル**: src/domain/models/issue.test.ts L89-109
- **実装状態**: 実装済み

### DOM-ISS-004: Issue.createWithAssignee() で status=Open かつ assigneeId が設定される
- **レイヤー**: Domain Unit
- **前提条件**: issueId, projectId, floorId, userId, `assigneeId = UserId.create('assignee-001')` を準備する
- **操作**: `Issue.createWithAssignee(issueId, projectId, floorId, 'タイトル', '説明', undefined, userId, location, dueDate, assigneeId)` を呼び出す
- **期待結果**: `issue.status === IssueStatus.Open` かつ `issue.assigneeId === assigneeId` である
- **根拠**: docs/phase0_plan.md §0.5 / TM-ISS-012
- **Truth Matrix ID**: TM-ISS-012
- **実装ファイル**: src/domain/models/issue.test.ts L112-138
- **実装状態**: 実装済み

### DOM-ISS-005: PointOut → Open への遷移 (assignTo 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `createTestIssue(IssueStatus.PointOut)` で status=PointOut の Issue を用意する
- **操作**: `issue.assignTo(UserId.create('new-assignee-001'))` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.Open` であり、`assigneeId` に指定した UserId が設定されている
- **根拠**: docs/phase0_plan.md §0.5 / TM-ISS-001
- **Truth Matrix ID**: TM-ISS-001, TM-ASG-002
- **実装ファイル**: src/domain/models/issue.test.ts L140-154
- **実装状態**: 実装済み

### DOM-ISS-006: Open → InProgress への遷移 (startWork 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `Issue.reconstruct(..., IssueStatus.Open, ...)` で status=Open の Issue を用意する
- **操作**: `issue.startWork()` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.InProgress` である
- **根拠**: CLAUDE.md 状態遷移ルール（Open → InProgress : 着手）
- **Truth Matrix ID**: TM-ISS-002
- **実装ファイル**: src/domain/models/issue.test.ts L156-177
- **実装状態**: 実装済み

### DOM-ISS-007: PointOut 状態から startWork() を呼ぶと InvalidStatusTransitionError が発生する
- **レイヤー**: Domain Unit
- **前提条件**: `createTestIssue(IssueStatus.PointOut)` で status=PointOut の Issue を用意する
- **操作**: `issue.startWork()` を呼び出す
- **期待結果**: `InvalidStatusTransitionError` がスローされる（PointOut → InProgress 直接遷移禁止）
- **根拠**: docs/phase0_plan.md §0.5 / TM-ISS-009
- **Truth Matrix ID**: TM-ISS-009
- **実装ファイル**: src/domain/models/issue.test.ts L170-177
- **実装状態**: 実装済み
- **備考**: TM-ISS-009 は PARTIAL 判定。PointOut → InProgress 禁止の明示的な仕様記述が不足するが実装では禁止されている

### DOM-ISS-008: InProgress → Done への遷移 (complete 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `createTestIssue(IssueStatus.InProgress)` で status=InProgress の Issue を用意する
- **操作**: `issue.complete()` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.Done` である
- **根拠**: CLAUDE.md 状態遷移ルール（InProgress → Done : 是正完了）
- **Truth Matrix ID**: TM-ISS-003
- **実装ファイル**: src/domain/models/issue.test.ts L179-199
- **実装状態**: 実装済み

### DOM-ISS-009: Open 状態から complete() を呼ぶと InvalidStatusTransitionError が発生する（Open → Done 直接遷移禁止）
- **レイヤー**: Domain Unit
- **前提条件**: `createTestIssue(IssueStatus.Open)` で status=Open の Issue を用意する
- **操作**: `issue.complete()` を呼び出す
- **期待結果**: `InvalidStatusTransitionError` がスローされる
- **根拠**: CLAUDE.md「Open → Done の直接遷移は禁止」/ docs/phase0_plan.md §0.5
- **Truth Matrix ID**: TM-ISS-008
- **実装ファイル**: src/domain/models/issue.test.ts L193-199
- **実装状態**: 実装済み
- **備考**: TM-ISS-008 は PARTIAL 判定。仕様書での明示が弱いが実装では正しく禁止されている

### DOM-ISS-010: InProgress → Open への差し戻し (rejectWork 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `createTestIssue(IssueStatus.InProgress)` で status=InProgress の Issue を用意する
- **操作**: `issue.rejectWork()` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.Open` である
- **根拠**: CLAUDE.md 状態遷移ルール（InProgress → Open : 差し戻し）
- **Truth Matrix ID**: TM-ISS-004
- **実装ファイル**: src/domain/models/issue.test.ts L202-214
- **実装状態**: 実装済み

### DOM-ISS-011: Done → Confirmed への遷移 (confirm 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `createTestIssue(IssueStatus.Done)` で status=Done の Issue を用意する
- **操作**: `issue.confirm()` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.Confirmed` である
- **根拠**: docs/phase0_plan.md §0.5 / TM-ISS-005
- **Truth Matrix ID**: TM-ISS-005
- **実装ファイル**: src/domain/models/issue.test.ts L216-228
- **実装状態**: 実装済み

### DOM-ISS-012: Done → Open への否認遷移 (rejectCompletion 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `createTestIssue(IssueStatus.Done)` で status=Done の Issue を用意する
- **操作**: `issue.rejectCompletion()` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.Open` である
- **根拠**: docs/phase0_plan.md §0.5 / TM-ISS-006
- **Truth Matrix ID**: TM-ISS-006
- **実装ファイル**: src/domain/models/issue.test.ts L230-242
- **実装状態**: 実装済み

### DOM-ISS-013: Confirmed → Open への再指摘遷移 (reissue 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `createTestIssue(IssueStatus.Confirmed)` で status=Confirmed の Issue を用意する
- **操作**: `issue.reissue()` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.Open` である
- **根拠**: docs/phase0_plan.md §0.5 / TM-ISS-007
- **Truth Matrix ID**: TM-ISS-007
- **実装ファイル**: src/domain/models/issue.test.ts L244-256
- **実装状態**: 実装済み

### DOM-ISS-014: Done → InProgress への再指摘遷移 (reopenAfterCompletion 正常系)
- **レイヤー**: Domain Unit
- **前提条件**: `createTestIssue(IssueStatus.Done)` で status=Done の Issue を用意する
- **操作**: `issue.reopenAfterCompletion()` を呼び出す
- **期待結果**: 返却された Issue の `status` が `IssueStatus.InProgress` である
- **根拠**: src/domain/models/issue.ts (実装準拠)
- **Truth Matrix ID**: TM-ISS-010
- **実装ファイル**: src/domain/models/issue.test.ts L258-270
- **実装状態**: 実装済み
- **備考**: TM-ISS-010 は MISSING_SPEC 判定。仕様書 (phase0_plan.md) への追記推奨。CLAUDE.md の状態遷移表には「Done → InProgress : 再指摘」が記載されているが、追加の仕様明記が望ましい

### DOM-ISS-015: Issue の IssuePriority が設定できる (Low/Medium/High/Critical の4区分)
- **レイヤー**: Domain Unit
- **前提条件**: 同上のID群を準備する
- **操作**: `Issue.create(..., IssuePriority.High)` を呼び出す
- **期待結果**: `issue.priority === IssuePriority.High` である
- **根拠**: src/domain/models/issue.ts（IssuePriority enum）
- **Truth Matrix ID**: TM-DOM-003
- **実装ファイル**: src/domain/models/issue.test.ts L299-324
- **実装状態**: 実装済み
- **備考**: TM-DOM-003 は PARTIAL 判定。Low/Medium/Critical の各値についても同様のテストが推奨される

---

## 2. 担当者 (Assignee) ルール

### DOM-ASG-001: PointOut 状態の Issue で changeAssignee() を呼ぶと Open に遷移し assigneeId が更新される
- **レイヤー**: Domain Unit
- **前提条件**: `createTestIssue(IssueStatus.PointOut)` で status=PointOut の Issue を用意する
- **操作**: `issue.changeAssignee(UserId.create('new-assignee-999'))` を呼び出す
- **期待結果**: `result.status === IssueStatus.Open` かつ `result.assigneeId === newAssigneeId` である
- **根拠**: docs/phase0_plan.md §0.5 / TM-ASG-002
- **Truth Matrix ID**: TM-ASG-002
- **実装ファイル**: src/domain/models/issue.test.ts L272-286
- **実装状態**: 実装済み

### DOM-ASG-002: InProgress 状態で changeAssignee() を呼ぶと InvalidStatusTransitionError がスローされる
- **レイヤー**: Domain Unit
- **前提条件**: `createTestIssue(IssueStatus.InProgress)` で status=InProgress の Issue を用意する
- **操作**: `issue.changeAssignee(UserId.create('new-assignee-002'))` を呼び出す
- **期待結果**: `InvalidStatusTransitionError` がスローされる
- **根拠**: src/domain/models/issue.ts（実装準拠）
- **Truth Matrix ID**: TM-ASG-004
- **実装ファイル**: src/domain/models/issue.test.ts L287-296
- **実装状態**: 実装済み
- **備考**: TM-ASG-004 は MISSING_SPEC 判定。phase0_plan.md への仕様追記推奨

### APP-ASG-001: Worker が自分担当の Issue のステータスを変更できる
- **レイヤー**: Application Integration
- **前提条件**: `createTestIssue(IssueStatus.Open, UserId.create('worker-id'))` で assigneeId='worker-id' の Issue をモックリポジトリに設定する
- **操作**: `handler.execute({ issueId: 'issue-001', projectId: 'project-001', newStatus: 'IN_PROGRESS', changedBy: 'worker-id' })` を呼び出す
- **期待結果**: `issueRepo.save` が呼ばれ、エラーなく正常終了する
- **根拠**: docs/phase0_plan.md §0.9 / TM-ASG-003
- **Truth Matrix ID**: TM-ASG-003
- **実装ファイル**: src/application/commands/issue-commands.test.ts L146-167
- **実装状態**: 実装済み

### APP-ASG-002: Worker が他者担当の Issue のステータスを変更しようとすると Error がスローされる
- **レイヤー**: Application Integration
- **前提条件**: `createTestIssue(IssueStatus.Open, UserId.create('assignee-id'))` で assigneeId='assignee-id' の Issue をモックリポジトリに設定する
- **操作**: `handler.execute({ issueId: 'issue-001', projectId: 'project-001', newStatus: 'IN_PROGRESS', changedBy: 'other-worker-id' })` を呼び出す
- **期待結果**: `'担当者以外はステータスを変更できません'` を含む Error がスローされる
- **根拠**: docs/phase0_plan.md §0.9 / TM-ASG-003
- **Truth Matrix ID**: TM-ASG-003
- **実装ファイル**: src/application/commands/issue-commands.test.ts L169-188
- **実装状態**: 実装済み

### API-ASG-001: PATCH /api/projects/{id}/issues/{issueId}/assignee - Supervisor が Assignee を変更できる（正常系）
- **レイヤー**: API Route
- **前提条件**: `requireRole` が `{ user: { id: 'user-001', role: 'SUPERVISOR' } }` を返すようモックする。`assignIssue.execute` が正常終了するようモックする
- **操作**: `PATCH /api/projects/p1/issues/i1/assignee` に `{ assigneeId: 'user-1' }` を JSON ボディで送信する
- **期待結果**: HTTP 200 が返り、`assignIssue.execute` が呼ばれる
- **根拠**: docs/api-design.md TM-API-017 / TM-AUTH-009
- **Truth Matrix ID**: TM-ASG-001, TM-AUTH-009
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/assignee/assignee.test.ts L47-72
- **実装状態**: 実装済み
- **備考**: TM-ASG-001 は CONFLICT 判定。api-design.md は Supervisor 限定と記載。TM-AUTH-009 も CONFLICT。実装準拠 (Supervisor 限定) でテストを定義

### API-ASG-002: PATCH /api/projects/{id}/issues/{issueId}/assignee - Worker ロールでは 403 が返る（異常系）
- **レイヤー**: API Route
- **前提条件**: `requireRole` が `{ error: 403 }` を返すようモックする
- **操作**: `PATCH /api/projects/p1/issues/i1/assignee` に `{ assigneeId: 'user-1' }` を JSON ボディで送信する
- **期待結果**: HTTP 403 が返る
- **根拠**: docs/api-design.md TM-API-017 / TM-AUTH-009
- **Truth Matrix ID**: TM-ASG-001, TM-AUTH-009
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/assignee/assignee.test.ts L74-93
- **実装状態**: 実装済み

---

## 3. 写真ルール

### DOM-PHT-001: PhotoPhase.Before で Photo が生成される
- **レイヤー**: Domain Unit
- **前提条件**: `PhotoId.create('photo-001')`, `IssueId.create('issue-001')` を準備する
- **操作**: `Photo.create(photoId, issueId, 'projects/p/issues/i/photos/x.jpg', PhotoPhase.Before, null)` を呼び出す
- **期待結果**: `photo.phase === PhotoPhase.Before` である
- **根拠**: docs/phase0_plan.md §0.8 / TM-PHT-002
- **Truth Matrix ID**: TM-PHT-002
- **実装ファイル**: src/domain/models/photo.test.ts L7-24
- **実装状態**: 実装済み

### DOM-PHT-002: PhotoPhase.After で Photo が生成される
- **レイヤー**: Domain Unit
- **前提条件**: `PhotoId.create('photo-002')`, `IssueId.create('issue-001')` を準備する
- **操作**: `Photo.create(photoId, issueId, 'projects/p/issues/i/photos/y.jpg', PhotoPhase.After, null)` を呼び出す
- **期待結果**: `photo.phase === PhotoPhase.After` である
- **根拠**: docs/phase0_plan.md §0.8 / TM-PHT-002
- **Truth Matrix ID**: TM-PHT-002
- **実装ファイル**: src/domain/models/photo.test.ts L26-43
- **実装状態**: 実装済み

### DOM-PHT-003: PhotoPhase.Rejection で Photo が生成される
- **レイヤー**: Domain Unit
- **前提条件**: `PhotoId.create('photo-003')`, `IssueId.create('issue-001')` を準備する
- **操作**: `Photo.create(photoId, issueId, 'projects/p/issues/i/photos/z.jpg', PhotoPhase.Rejection, null)` を呼び出す
- **期待結果**: `photo.phase === PhotoPhase.Rejection` である
- **根拠**: docs/phase0_plan.md §0.8 / TM-PHT-002
- **Truth Matrix ID**: TM-PHT-002
- **実装ファイル**: src/domain/models/photo.test.ts L45-62
- **実装状態**: 実装済み

### DOM-PHT-004: Photo.create() で blobKey に空文字を渡すと Error がスローされる
- **レイヤー**: Domain Unit
- **前提条件**: `PhotoId.create('photo-004')`, `IssueId.create('issue-001')` を準備する
- **操作**: `Photo.create(photoId, issueId, '', PhotoPhase.Before, null)` を呼び出す
- **期待結果**: `'Photo blobKey must not be empty'` を含む Error がスローされる
- **根拠**: ドメインバリデーション要件
- **Truth Matrix ID**: TM-PHT-003
- **実装ファイル**: src/domain/models/photo.test.ts L64-72
- **実装状態**: 実装済み

### APP-PHT-001: InProgress → Done 時に After 写真が 0 枚だと Error がスローされる（境界値）
- **レイヤー**: Application Integration
- **前提条件**: `createTestIssue(IssueStatus.InProgress)` の Issue をモックリポジトリに設定し、photoRepo が空配列を返すようモックする
- **操作**: `handler.execute({ issueId: 'issue-001', projectId: 'project-001', newStatus: 'DONE', changedBy: 'user-001' })` を呼び出す
- **期待結果**: `'是正完了には是正後写真が1枚以上必要です'` を含む Error がスローされる
- **根拠**: CLAUDE.md 状態遷移ルール「是正後写真1枚以上必要」/ TM-PHT-001
- **Truth Matrix ID**: TM-PHT-001
- **実装ファイル**: src/application/commands/issue-commands.test.ts L104-122
- **実装状態**: 実装済み

### APP-PHT-002: InProgress → Done 時に After 写真が 1 枚以上あると遷移が成功する（境界値）
- **レイヤー**: Application Integration
- **前提条件**: `createTestIssue(IssueStatus.InProgress)` の Issue をモックリポジトリに設定し、photoRepo が `[createAfterPhoto()]` を返すようモックする
- **操作**: `handler.execute({ issueId: 'issue-001', projectId: 'project-001', newStatus: 'DONE', changedBy: 'user-001' })` を呼び出す
- **期待結果**: `issueRepo.save` が呼ばれ、エラーなく正常終了する
- **根拠**: CLAUDE.md 状態遷移ルール / TM-PHT-001
- **Truth Matrix ID**: TM-PHT-001
- **実装ファイル**: src/application/commands/issue-commands.test.ts L124-143
- **実装状態**: 実装済み

### APP-PHT-003: AddPhotoHandler が BlobKey を正規形式で生成する
- **レイヤー**: Application Integration
- **前提条件**: `Issue.reconstruct(IssueId.create('i1'), ProjectId.create('p1'), ...)` の Issue をモックリポジトリに設定し、photoStorage と photoRepo をモックする
- **操作**: `handler.execute({ issueId: 'i1', projectId: 'p1', file: Buffer.from('fake'), fileName: 'photo.jpg', contentType: 'image/jpeg', photoPhase: 'BEFORE', uploadedBy: 'u1' })` を呼び出す
- **期待結果**: `photoStorage.upload` の第1引数が `/^projects\/p1\/issues\/i1\/photos\/.+\.jpg$/` パターンに合致する
- **根拠**: CLAUDE.md Blob保存戦略「キー命名: projects/{projectId}/issues/{issueId}/photos/{photoId}.{ext}」/ TM-PHT-003
- **Truth Matrix ID**: TM-PHT-003
- **実装ファイル**: src/application/commands/issue-commands.test.ts L360-398
- **実装状態**: 実装済み

### APP-PHT-004: AddPhotoHandler が PhotoStorage.upload() を先に呼び、その後 IPhotoRepository.save() を呼ぶ
- **レイヤー**: Application Integration
- **前提条件**: `callOrder: string[]` 配列を用意し、`photoStorage.upload` が呼ばれた時に `'upload'` を追記、`photoRepo.save` が呼ばれた時に `'save'` を追記するようモックする
- **操作**: `handler.execute({ issueId: 'issue-001', projectId: 'p1', file: Buffer.from('fake'), fileName: 'x.png', contentType: 'image/png', photoPhase: 'AFTER', uploadedBy: 'u1' })` を呼び出す
- **期待結果**: `callOrder` が `['upload', 'save']` であり、upload のインデックスが save より小さい
- **根拠**: CLAUDE.md Blob保存戦略「アップロード順序: ① Blob保存 → ② DB記録」/ TM-PHT-004
- **Truth Matrix ID**: TM-PHT-004
- **実装ファイル**: src/application/commands/issue-commands.test.ts L400-454
- **実装状態**: 実装済み
- **備考**: TM-PHT-004 は PARTIAL 判定。Blob保存失敗時のロールバック動作についての仕様追記推奨

### API-PHT-001: Issue 作成時に BEFORE 写真が必須である（境界値）
- **レイヤー**: API Route
- **前提条件**: Admin セッションが設定されている
- **操作**: `POST /api/projects/p1/issues` に multipart/form-data で必須フィールドを含むが写真ファイルを含まないリクエストを送信する
- **期待結果**: HTTP 400 が返り、レスポンスボディに `'At least one BEFORE photo is required'` が含まれる
- **根拠**: docs/phase0_plan.md §0.8 / TM-PHT-005
- **Truth Matrix ID**: TM-PHT-005
- **実装ファイル**: src/app/api/projects/[id]/issues/issues.test.ts L117-144
- **実装状態**: 実装済み
- **備考**: TM-PHT-005 は PARTIAL 判定。仕様書での明示記述が不足しているが実装では強制されている

### APP-PHT-006: Confirmed → Open (再指摘) 時に Rejection 写真なしだと Error がスローされる
- **レイヤー**: Application Integration
- **前提条件**: `createTestIssue(IssueStatus.Confirmed)` の Issue をモックリポジトリに設定し、photoRepo が空配列を返すようモックする
- **操作**: `handler.execute({ issueId: 'issue-001', projectId: 'project-001', newStatus: 'OPEN', changedBy: 'user-001', comment: '再指摘理由' })` を呼び出す
- **期待結果**: `'再指摘には否認時写真が1枚以上必要です'` を含む Error がスローされる
- **根拠**: src/application/commands/update-issue-status.ts（実装準拠）/ TM-PHT-006
- **Truth Matrix ID**: TM-PHT-006
- **実装ファイル**: src/application/commands/issue-commands.test.ts L234-253
- **実装状態**: 実装済み
- **備考**: TM-PHT-006 は MISSING_SPEC 判定。phase0_plan.md への仕様追記推奨

### APP-PHT-007: Confirmed → Open (再指摘) 時に Rejection 写真が 1 枚以上あると遷移が成功する（境界値）
- **レイヤー**: Application Integration
- **前提条件**: `createTestIssue(IssueStatus.Confirmed)` の Issue と `[createRejectionPhoto()]` をモックリポジトリに設定し、コメントありで呼び出す
- **操作**: `handler.execute({ issueId: 'issue-001', projectId: 'project-001', newStatus: 'OPEN', changedBy: 'user-001', comment: '再指摘理由' })` を呼び出す
- **期待結果**: `issueRepo.save` が呼ばれ、エラーなく正常終了する
- **根拠**: src/application/commands/update-issue-status.ts（実装準拠）/ TM-PHT-006
- **Truth Matrix ID**: TM-PHT-006
- **実装ファイル**: src/application/commands/issue-commands.test.ts L255-275
- **実装状態**: 実装済み

---

## 4. ステータス変更コメントルール

### APP-ISS-001: Done → Open (否認) 時にコメントなしだと Error がスローされる
- **レイヤー**: Application Integration
- **前提条件**: `createTestIssue(IssueStatus.Done)` の Issue をモックリポジトリに設定し、photoRepo が `[createAfterPhoto()]` を返すようモックする
- **操作**: `handler.execute({ issueId: 'issue-001', projectId: 'project-001', newStatus: 'OPEN', changedBy: 'user-001', comment: '' })` を呼び出す
- **期待結果**: `'否認・再指摘にはコメントが必須です'` を含む Error がスローされる
- **根拠**: docs/phase0_plan.md §0.5（コメント必須）/ TM-ISS-006
- **Truth Matrix ID**: TM-ISS-006
- **実装ファイル**: src/application/commands/issue-commands.test.ts L193-211
- **実装状態**: 実装済み

### APP-ISS-002: Confirmed → Open (再指摘) 時にコメント undefined だと Error がスローされる
- **レイヤー**: Application Integration
- **前提条件**: `createTestIssue(IssueStatus.Confirmed)` の Issue と Rejection 写真をモックリポジトリに設定する
- **操作**: `handler.execute({ issueId: 'issue-001', projectId: 'project-001', newStatus: 'OPEN', changedBy: 'user-001', comment: undefined })` を呼び出す
- **期待結果**: `'否認・再指摘にはコメントが必須です'` を含む Error がスローされる
- **根拠**: docs/phase0_plan.md §0.5（コメント必須）/ TM-ISS-007
- **Truth Matrix ID**: TM-ISS-007
- **実装ファイル**: src/application/commands/issue-commands.test.ts L213-232
- **実装状態**: 実装済み

### APP-ISS-003: 不正な状態遷移要求時に InvalidStatusTransitionError がスローされる
- **レイヤー**: Application Integration
- **前提条件**: `createTestIssue(IssueStatus.Open)` の Issue をモックリポジトリに設定する
- **操作**: `handler.execute({ issueId: 'issue-001', projectId: 'project-001', newStatus: 'CONFIRMED', changedBy: 'user-001' })` を呼び出す（Open → Confirmed は不正遷移）
- **期待結果**: `InvalidStatusTransitionError` がスローされる
- **根拠**: CLAUDE.md 状態遷移ルール（許可されない遷移）
- **Truth Matrix ID**: TM-ISS-008, TM-ISS-009
- **実装ファイル**: src/application/commands/issue-commands.test.ts L277-295
- **実装状態**: 実装済み

### APP-ISS-004: StatusChangeLog がステータス変更後に保存される
- **レイヤー**: Application Integration
- **前提条件**: `createTestIssue(IssueStatus.Open)` の Issue をモックリポジトリに設定し、`logRepo.save` をスパイする
- **操作**: `handler.execute({ issueId: 'issue-001', projectId: 'project-001', newStatus: 'IN_PROGRESS', changedBy: 'user-001' })` を呼び出す
- **期待結果**: `logRepo.save` が1回呼ばれ、保存された `StatusChangeLog` の `fromStatus` が `IssueStatus.Open`、`toStatus` が `IssueStatus.InProgress` である
- **根拠**: docs/phase0_plan.md（StatusChangeLog子エンティティ）/ TM-DOM-002
- **Truth Matrix ID**: TM-DOM-002
- **実装ファイル**: src/application/commands/issue-commands.test.ts L298-322
- **実装状態**: 実装済み

---

## 5. Organization (組織)

### DOM-ORG-001: Branch 型の Organization が正常に生成される
- **レイヤー**: Domain Unit
- **前提条件**: `OrganizationId.create('org-001')`, `OrganizationId.create('hq-001')` を準備する
- **操作**: `Organization.create(id, '東京支部', OrganizationType.Branch, parentId)` を呼び出す
- **期待結果**: `org.type === OrganizationType.Branch` かつ `org.name === '東京支部'` である
- **根拠**: docs/phase0_plan.md §0.3 / TM-ORG-002
- **Truth Matrix ID**: TM-ORG-002
- **実装ファイル**: src/domain/models/organization.test.ts L7-18
- **実装状態**: 実装済み

### DOM-ORG-002: Organization.create() で name 空文字を渡すと Error がスローされる
- **レイヤー**: Domain Unit
- **前提条件**: `OrganizationId.create('org-003')`, `OrganizationId.create('hq-001')` を準備する
- **操作**: `Organization.create(id, '', OrganizationType.Branch, parentId)` を呼び出す
- **期待結果**: `'Organization name must not be empty'` を含む Error がスローされる
- **根拠**: ドメインバリデーション要件
- **Truth Matrix ID**: TM-ORG-002
- **実装ファイル**: src/domain/models/organization.test.ts L32-43
- **実装状態**: 実装済み

### APP-ORG-001: DeleteOrganizationHandler で HQ 組織を削除しようとすると DomainError がスローされる
- **レイヤー**: Application Integration
- **前提条件**: `Organization.reconstruct(OrganizationId.create('hq-org-id'), '本社', OrganizationType.Headquarters, ...)` でモックリポジトリに HQ 組織を設定する
- **操作**: `handler.execute('hq-org-id')` を呼び出す
- **期待結果**: `DomainError` がスローされ、メッセージに `'Cannot delete headquarters organization'` が含まれる
- **根拠**: docs/phase0_plan.md §0.3 / TM-ORG-004
- **Truth Matrix ID**: TM-ORG-004
- **実装ファイル**: src/application/commands/org-commands.test.ts L61-72
- **実装状態**: 実装済み
- **備考**: TM-ORG-004 は PARTIAL 判定。HQ 唯一性の検証（シーダのみでの初期登録）についての仕様追記推奨

### APP-ORG-002: DeleteOrganizationHandler でユーザーが所属する Branch 組織を削除しようとすると OrganizationHasUsersError がスローされる
- **レイヤー**: Application Integration
- **前提条件**: Branch 組織をモックリポジトリに設定し、`prisma.user.count` が 1 を返すようモックする
- **操作**: `handler.execute('branch-org-id')` を呼び出す
- **期待結果**: `OrganizationHasUsersError` がスローされる
- **根拠**: docs/phase0_plan.md §0.3 / TM-ORG-005
- **Truth Matrix ID**: TM-ORG-005
- **実装ファイル**: src/application/commands/org-commands.test.ts L74-85
- **実装状態**: 実装済み
- **備考**: TM-ORG-005 は PARTIAL 判定。実装が Application 層から prisma を直接参照しているアーキテクチャ違反あり（TM-ARC-003 との関連）

### APP-ORG-003: ユーザーが所属しない Branch 組織は正常に削除される
- **レイヤー**: Application Integration
- **前提条件**: Branch 組織をモックリポジトリに設定し、`prisma.user.count` が 0 を返すようモックする
- **操作**: `handler.execute('branch-org-id')` を呼び出す
- **期待結果**: `repo.delete` が呼ばれ、エラーなく正常終了する
- **根拠**: docs/phase0_plan.md §0.3 / TM-ORG-005
- **Truth Matrix ID**: TM-ORG-005
- **実装ファイル**: src/application/commands/org-commands.test.ts L87-99
- **実装状態**: 実装済み

### APP-ORG-004: CreateOrganizationHandler は BRANCH 型の組織のみ作成できる
- **レイヤー**: Application Integration
- **前提条件**: モックリポジトリを用意し、`CreateOrganizationHandler` をインスタンス化する
- **操作**: `handler.execute({ name: '大阪支部', parentId: 'hq-id' })` を呼び出す
- **期待結果**: `repo.save` が呼ばれ、保存された Organization の `type` が `OrganizationType.Branch` であり `name` が `'大阪支部'` である
- **根拠**: docs/phase0_plan.md §0.3「アプリから作成可能はBranchのみ」/ TM-ORG-002
- **Truth Matrix ID**: TM-ORG-002, TM-ORG-003
- **実装ファイル**: src/application/commands/org-commands.test.ts L102-118
- **実装状態**: 実装済み
- **備考**: TM-ORG-003 は PARTIAL 判定。HQ type を明示して CreateOrganizationHandler を呼び出した場合のバリデーションエラーのテストが未実装

### APP-ORG-005: HQ type を指定して CreateOrganizationHandler を呼ぶとバリデーションエラーがスローされる（TM-ORG-003 補完）
- **レイヤー**: Application Integration
- **前提条件**: モックリポジトリを用意し、`CreateOrganizationHandler` をインスタンス化する
- **操作**: `handler.execute({ name: '本社2', type: 'HEADQUARTERS', parentId: undefined })` を呼び出す
- **期待結果**: バリデーションエラーがスローされ、HQ 型の組織が作成されない
- **根拠**: docs/phase0_plan.md §0.3 / TM-ORG-003
- **Truth Matrix ID**: TM-ORG-003
- **実装ファイル**: src/application/commands/org-commands.test.ts
- **実装状態**: 未実装
- **備考**: TM-ORG-003 は PARTIAL 判定。仕様追記推奨

### API-ORG-001: GET /api/organizations - Admin ロールで正常に一覧取得できる（正常系）
- **レイヤー**: API Route
- **前提条件**: `getServerSession` が `{ user: { id: 'user-001', role: 'ADMIN' } }` を返すようモックする
- **操作**: `GET /api/organizations` を呼び出す
- **期待結果**: HTTP 200 が返る
- **根拠**: docs/api-design.md TM-API-023 / TM-ORG-006
- **Truth Matrix ID**: TM-ORG-006
- **実装ファイル**: src/app/api/organizations/organizations.test.ts L42-53
- **実装状態**: 実装済み

### API-ORG-002: GET /api/organizations - Supervisor/Worker ロールでは 403 が返る（異常系）
- **レイヤー**: API Route
- **前提条件**: `getServerSession` が Supervisor または Worker ロールのセッションを返すようモックする
- **操作**: `GET /api/organizations` を呼び出す
- **期待結果**: HTTP 403 が返る
- **根拠**: TM-ORG-006「Admin 限定」
- **Truth Matrix ID**: TM-ORG-006
- **実装ファイル**: src/app/api/organizations/organizations.test.ts L55-76
- **実装状態**: 実装済み

### API-ORG-003: POST /api/organizations - Admin で Branch 組織作成が成功する（正常系）
- **レイヤー**: API Route
- **前提条件**: Admin セッションをモックし、`createOrganization.execute` が正常終了するようモックする
- **操作**: `POST /api/organizations` に `{ name: '大阪支部', parentId: 'hq-id' }` を JSON ボディで送信する
- **期待結果**: HTTP 201 が返る
- **根拠**: docs/api-design.md TM-API-024 / TM-ORG-002
- **Truth Matrix ID**: TM-ORG-002, TM-ORG-006
- **実装ファイル**: src/app/api/organizations/organizations.test.ts L78-106
- **実装状態**: 実装済み

### API-ORG-004: POST /api/organizations - name 未指定の場合 400 が返る（異常系）
- **レイヤー**: API Route
- **前提条件**: Admin セッションをモックする
- **操作**: `POST /api/organizations` に `{ parentId: 'hq-id' }` のみ（name なし）を JSON ボディで送信する
- **期待結果**: HTTP 400 が返る
- **根拠**: ドメインバリデーション要件 / TM-ORG-002
- **Truth Matrix ID**: TM-ORG-002
- **実装ファイル**: src/app/api/organizations/organizations.test.ts L108-123
- **実装状態**: 実装済み

---

## 6. User (ユーザー)

### DOM-USR-001: User.create() で isActive=true の User が生成される
- **レイヤー**: Domain Unit
- **前提条件**: `UserId.create('user-001')`, `OrganizationId.create('org-001')` を準備する
- **操作**: `User.create(id, orgId, '田中太郎', 'tanaka@example.com', UserRole.Worker)` を呼び出す
- **期待結果**: `user.isActive === true` かつ `user.role === UserRole.Worker` である
- **根拠**: docs/phase0_plan.md §0.3（論理削除）/ TM-USR-004
- **Truth Matrix ID**: TM-USR-004, TM-USR-006
- **実装ファイル**: src/domain/models/user.test.ts L8-19
- **実装状態**: 実装済み

### DOM-USR-002: User.create() で @ を含まないメールアドレスを渡すと Error がスローされる
- **レイヤー**: Domain Unit
- **前提条件**: `UserId.create('user-002')`, `OrganizationId.create('org-001')` を準備する
- **操作**: `User.create(id, orgId, '田中太郎', 'invalid-email', UserRole.Worker)` を呼び出す（@ なし）
- **期待結果**: `'User email must be valid'` を含む Error がスローされる
- **根拠**: docs/phase0_plan.md §0.3（Emailバリデーション）/ TM-USR-003
- **Truth Matrix ID**: TM-USR-003
- **実装ファイル**: src/domain/models/user.test.ts L21-32
- **実装状態**: 実装済み
- **備考**: TM-USR-003 は PARTIAL 判定。Email一意制約（TM-USR-002）は DB レベルの制約であり、ドメインモデルテスト単独では検証不可

### APP-USR-001: CreateUserHandler が bcrypt でパスワードをハッシュ化して保存する
- **レイヤー**: Application Integration
- **前提条件**: `prisma.user.create` をモックし、渡された data を `capturedData` に記録するよう設定する
- **操作**: `handler.execute({ name: '田中太郎', email: 'tanaka@example.com', password: 'plain-text-pw', role: 'WORKER', organizationId: 'org-001' })` を呼び出す
- **期待結果**: 保存された `password_hash` が `'plain-text-pw'` と異なり、`bcrypt.compareSync('plain-text-pw', savedData.password_hash)` が `true` を返す
- **根拠**: docs/phase0_plan.md §0.3（パスワードhash）/ TM-USR-005
- **Truth Matrix ID**: TM-USR-005
- **実装ファイル**: src/application/commands/user-commands.test.ts L24-51
- **実装状態**: 実装済み

### APP-USR-002: CreateUserHandler がドメインモデルを経由せず prisma を直接参照している（レイヤー違反の検知）
- **レイヤー**: Application Integration
- **前提条件**: `create-user.ts` のソースコードを読み込む
- **操作**: ソースコードに `"import prisma from '../../infrastructure/prisma/prisma-client'"` が含まれているか確認する
- **期待結果**: ソースコードに prisma の直接インポートが含まれる
- **根拠**: TM-ARC-002 (CONFLICT) / TM-ARC-003 (CONFLICT)
- **Truth Matrix ID**: TM-ARC-002, TM-ARC-003, TM-USR-007
- **実装ファイル**: src/application/commands/user-commands.test.ts L54-72
- **実装状態**: 実装済み
- **備考**: TM-USR-007 は MISSING_SPEC 判定。TM-ARC-002, TM-ARC-003 は CONFLICT 判定。CreateUserHandler が Application 層から直接 Infrastructure を参照しているレイヤー違反が存在する。将来は UserRepository インターフェース経由に改善が必要

### API-USR-001: GET /api/users - Admin のみアクセス可能（正常系）
- **レイヤー**: API Route
- **前提条件**: `getServerSession` が Admin ロールのセッションを返すようモックする
- **操作**: `GET /api/users` を呼び出す
- **期待結果**: HTTP 200 が返る
- **根拠**: docs/api-design.md TM-API-027 / TM-USR-001
- **Truth Matrix ID**: TM-USR-001
- **実装ファイル**: src/app/api/users/users.test.ts L43-54
- **実装状態**: 実装済み

### API-USR-002: GET /api/users - Supervisor/Worker ロールでは 403 が返る（異常系）
- **レイヤー**: API Route
- **前提条件**: Supervisor または Worker ロールのセッションをモックする
- **操作**: `GET /api/users` を呼び出す
- **期待結果**: HTTP 403 が返る
- **根拠**: TM-USR-001「Admin 限定」
- **Truth Matrix ID**: TM-USR-001
- **実装ファイル**: src/app/api/users/users.test.ts L56-76
- **実装状態**: 実装済み

### API-USR-003: GET /api/users - 未認証リクエストでは 401 が返る
- **レイヤー**: API Route
- **前提条件**: `getServerSession` が null を返すようモックする
- **操作**: `GET /api/users` を呼び出す
- **期待結果**: HTTP 401 が返る
- **根拠**: 認証ルール / TM-AUTH-001
- **Truth Matrix ID**: TM-USR-001
- **実装ファイル**: src/app/api/users/users.test.ts L78-89
- **実装状態**: 実装済み

### API-USR-004: POST /api/users - Admin でユーザー作成が成功する（正常系）
- **レイヤー**: API Route
- **前提条件**: Admin セッションをモックし、`createUser.execute` が `{ userId: 'new-user-id' }` を返すようモックする
- **操作**: `POST /api/users` に `{ name: '田中太郎', email: 'tanaka@example.com', password: 'password123', role: 'WORKER', organizationId: 'org-001' }` を JSON ボディで送信する
- **期待結果**: HTTP 201 が返り、レスポンスボディに `userId` プロパティが含まれる
- **根拠**: docs/api-design.md TM-API-028 / TM-USR-001
- **Truth Matrix ID**: TM-USR-001
- **実装ファイル**: src/app/api/users/users.test.ts L92-120
- **実装状態**: 実装済み

### API-USR-005: POST /api/users - Supervisor ロールでは 403 が返る（異常系）
- **レイヤー**: API Route
- **前提条件**: Supervisor セッションをモックする
- **操作**: `POST /api/users` に必要なフィールドを送信する
- **期待結果**: HTTP 403 が返る
- **根拠**: TM-USR-001「Admin 限定」
- **Truth Matrix ID**: TM-USR-001
- **実装ファイル**: src/app/api/users/users.test.ts L122-143
- **実装状態**: 実装済み

### API-USR-006: DELETE /api/users/{id} - Admin で論理削除が成功する（正常系）
- **レイヤー**: API Route
- **前提条件**: Admin セッションをモックし、`deactivateUser.execute` が正常終了するようモックする
- **操作**: `DELETE /api/users/user-001` を呼び出す
- **期待結果**: HTTP 200 が返り、レスポンスボディに `{ message: 'User deactivated' }` が含まれる
- **根拠**: docs/api-design.md TM-API-030 / TM-USR-004
- **Truth Matrix ID**: TM-USR-004
- **実装ファイル**: src/app/api/users/[id]/users-id.test.ts L31-52
- **実装状態**: 実装済み

### API-USR-007: DELETE /api/users/{id} - Supervisor ロールでは 403 が返る（異常系）
- **レイヤー**: API Route
- **前提条件**: Supervisor セッションをモックする
- **操作**: `DELETE /api/users/user-001` を呼び出す
- **期待結果**: HTTP 403 が返る
- **根拠**: TM-USR-001「Admin 限定」
- **Truth Matrix ID**: TM-USR-001
- **実装ファイル**: src/app/api/users/[id]/users-id.test.ts L54-67
- **実装状態**: 実装済み

---

## 7. 認可 (Auth)

### API-AUT-001: POST /api/projects/{id}/issues - Admin ロールで Issue 作成が成功する（正常系）
- **レイヤー**: API Route
- **前提条件**: Admin ロールが設定されている。`createIssue.execute` と `addPhoto.execute` が正常終了するようモックする
- **操作**: `POST /api/projects/p1/issues` に multipart/form-data で floorId, title, description, dueDate, locationType, dbId, photoPhase, file を含めて送信する
- **期待結果**: HTTP 201 が返る
- **根拠**: docs/api-design.md TM-API-011 / TM-AUTH-001
- **Truth Matrix ID**: TM-AUTH-001
- **実装ファイル**: src/app/api/projects/[id]/issues/issues.test.ts L60-97
- **実装状態**: 実装済み

### API-AUT-002: POST /api/projects/{id}/issues - Worker ロールでは 403 が返る（異常系）
- **レイヤー**: API Route
- **前提条件**: `requireRole` が `{ error: 403 }` を返すようモックする
- **操作**: `POST /api/projects/p1/issues` を呼び出す
- **期待結果**: HTTP 403 が返る
- **根拠**: TM-AUTH-001「指摘登録: Admin, Supervisor」
- **Truth Matrix ID**: TM-AUTH-001
- **実装ファイル**: src/app/api/projects/[id]/issues/issues.test.ts L99-115
- **実装状態**: 実装済み

### API-AUT-003: POST /api/projects - Admin ロールで Project 作成が成功する（正常系）
- **レイヤー**: API Route
- **前提条件**: Admin ロールが設定されている。`createProject.execute` が `'new-project-id'` を返すようモックする
- **操作**: `POST /api/projects` に `{ buildingId: 'building-001', name: '新プロジェクト', startDate: '2026-01-01', dueDate: '2026-12-31', branchId: 'branch-001' }` を送信する
- **期待結果**: HTTP 201 が返る
- **根拠**: docs/api-design.md TM-API-009 / TM-AUTH-007
- **Truth Matrix ID**: TM-AUTH-007, TM-PRJ-002
- **実装ファイル**: src/app/api/projects/projects.test.ts L123-150
- **実装状態**: 実装済み

### API-AUT-004: POST /api/projects - Supervisor/Worker ロールでは 403 が返る（異常系）
- **レイヤー**: API Route
- **前提条件**: `requireRole` が `{ error: 403 }` を返すようモックする
- **操作**: `POST /api/projects` を呼び出す
- **期待結果**: HTTP 403 が返る
- **根拠**: TM-AUTH-007「Project 作成・更新: Admin 限定」
- **Truth Matrix ID**: TM-AUTH-007, TM-PRJ-002
- **実装ファイル**: src/app/api/projects/projects.test.ts L152-174
- **実装状態**: 実装済み

### API-AUT-005: PATCH /api/.../status - Worker が CONFIRMED を指定すると 403 が返る（異常系）
- **レイヤー**: API Route
- **前提条件**: Worker ロールのセッションをモックする
- **操作**: `PATCH /api/projects/p1/issues/i1/status` に `{ status: 'CONFIRMED' }` を送信する
- **期待結果**: HTTP 403 が返り、レスポンスボディに `{ error: 'Workers cannot approve issues' }` が含まれる
- **根拠**: TM-AUTH-004「Done->Confirmed: Admin, Supervisor」
- **Truth Matrix ID**: TM-AUTH-004, TM-AUTH-002
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/status/status.test.ts L50-70
- **実装状態**: 実装済み

### API-AUT-006: PATCH /api/.../status - Supervisor が CONFIRMED を指定できる（正常系）
- **レイヤー**: API Route
- **前提条件**: Supervisor ロールのセッションをモックし、`updateIssueStatus.execute` が正常終了するようモックする
- **操作**: `PATCH /api/projects/p1/issues/i1/status` に `{ status: 'CONFIRMED' }` を送信する
- **期待結果**: HTTP 200 が返る
- **根拠**: TM-AUTH-004「Done->Confirmed: Admin, Supervisor」
- **Truth Matrix ID**: TM-AUTH-004
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/status/status.test.ts L72-93
- **実装状態**: 実装済み

### API-AUT-007: POST /api/.../photos - Worker ロールで写真アップロードが成功する（正常系）
- **レイヤー**: API Route
- **前提条件**: Worker ロールが設定されている。`addPhoto.execute` が `'photo-new-001'` を返すようモックする
- **操作**: `POST /api/projects/p1/issues/i1/photos` に multipart/form-data で有効な jpg ファイルと photoPhase を送信する
- **期待結果**: HTTP 201 が返る
- **根拠**: docs/api-design.md TM-API-018 / TM-AUTH-003
- **Truth Matrix ID**: TM-AUTH-003
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/photos/photos.test.ts L79-106
- **実装状態**: 実装済み
- **備考**: TM-AUTH-003 は CONFLICT 判定。api-design.md は Worker を含む全ロールを許可と記載しているが、別資料に Worker 制限の記載がある。実装準拠（Worker 含む全ロール許可）でテストを定義

### API-AUT-013: POST /api/.../photos - Admin ロールで写真アップロードが成功する（正常系）
- **レイヤー**: API Route
- **前提条件**: Admin ロールが設定されている。`addPhoto.execute` が `'photo-new-002'` を返すようモックする
- **操作**: `POST /api/projects/p1/issues/i1/photos` に multipart/form-data で有効な jpg ファイルと `photoPhase='AFTER'` を送信する
- **期待結果**: HTTP 201 が返る
- **根拠**: docs/api-design.md TM-API-018 / TM-AUTH-003
- **Truth Matrix ID**: TM-AUTH-003
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/photos/photos.test.ts
- **実装状態**: 未実装
- **備考**: TM-AUTH-003 は CONFLICT 判定。Admin ロールでの写真追加を明示的に確認するテストが不足していたため追加

### API-AUT-014: POST /api/.../photos - Supervisor ロールで写真アップロードが成功する（正常系）
- **レイヤー**: API Route
- **前提条件**: Supervisor ロールが設定されている。`addPhoto.execute` が `'photo-new-003'` を返すようモックする
- **操作**: `POST /api/projects/p1/issues/i1/photos` に multipart/form-data で有効な jpg ファイルと `photoPhase='BEFORE'` を送信する
- **期待結果**: HTTP 201 が返る
- **根拠**: docs/api-design.md TM-API-018 / TM-AUTH-003
- **Truth Matrix ID**: TM-AUTH-003
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/photos/photos.test.ts
- **実装状態**: 未実装
- **備考**: TM-AUTH-003 は CONFLICT 判定。Supervisor ロールでの写真追加を明示的に確認するテストが不足していたため追加

### API-AUT-008: DELETE /api/.../issues/{issueId} - Supervisor ロールで削除が成功する（正常系）
- **レイヤー**: API Route
- **前提条件**: Supervisor ロールが設定されている。`deleteIssue.execute` が正常終了するようモックする
- **操作**: `DELETE /api/projects/p1/issues/i1` を呼び出す
- **期待結果**: HTTP 200 が返り、`{ message: 'Issue deleted successfully' }` が含まれる
- **根拠**: docs/api-design.md TM-API-015 / TM-AUTH-008
- **Truth Matrix ID**: TM-AUTH-008
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/issues-id.test.ts L48-71
- **実装状態**: 実装済み
- **備考**: TM-AUTH-008 は PARTIAL 判定。Supervisor のみ許可か他のロールも可能かの仕様明確化推奨

### API-AUT-009: DELETE /api/.../issues/{issueId} - Admin/Worker ロールでは 403 が返る（異常系）
- **レイヤー**: API Route
- **前提条件**: `requireRole` が `{ error: 403 }` を返すようモックする
- **操作**: `DELETE /api/projects/p1/issues/i1` を呼び出す
- **期待結果**: HTTP 403 が返る
- **根拠**: TM-AUTH-008「指摘削除: Supervisor 限定」
- **Truth Matrix ID**: TM-AUTH-008
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/issues-id.test.ts L73-89
- **実装状態**: 実装済み

### API-AUT-010: PATCH /api/.../issues/{issueId} - Admin/Supervisor でタイトル更新が成功する（正常系）
- **レイヤー**: API Route
- **前提条件**: Admin ロールが設定されている。`updateIssueTitle.execute` が正常終了するようモックする
- **操作**: `PATCH /api/projects/p1/issues/i1` に `{ title: '新タイトル' }` を送信する
- **期待結果**: HTTP 200 が返る
- **根拠**: docs/api-design.md TM-API-014 / TM-AUTH-002
- **Truth Matrix ID**: TM-AUTH-002
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/issues-id.test.ts L92-120
- **実装状態**: 実装済み

### API-AUT-011: PATCH /api/.../issues/{issueId} - Worker ロールでは 403 が返る（異常系）
- **レイヤー**: API Route
- **前提条件**: `requireRole` が `{ error: 403 }` を返すようモックする
- **操作**: `PATCH /api/projects/p1/issues/i1` に `{ title: '新タイトル' }` を送信する
- **期待結果**: HTTP 403 が返る
- **根拠**: TM-AUTH-002
- **Truth Matrix ID**: TM-AUTH-002
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/issues-id.test.ts L122-140
- **実装状態**: 実装済み

### API-AUT-015: PATCH /api/projects/{id}/issues/{issueId} - Supervisor ロールでタイトル更新が成功する（正常系）
- **レイヤー**: API Route
- **前提条件**: Supervisor ロールが設定されている。`updateIssueTitle.execute` が正常終了するようモックする
- **操作**: `PATCH /api/projects/p1/issues/i1` に `{ title: '新タイトル' }` を送信する
- **期待結果**: HTTP 200 が返る
- **根拠**: docs/api-design.md TM-API-014 / TM-AUTH-002「Issue 更新: Admin, Supervisor」
- **Truth Matrix ID**: TM-AUTH-002
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/issues-id.test.ts
- **実装状態**: 未実装
- **備考**: API-AUT-010 は Admin のみテスト済み。Supervisor も許可されていることを明示的に確認するテストとして追加

### API-AUT-012: 未認証リクエストは 401 が返る
- **レイヤー**: API Route
- **前提条件**: セッションが存在しない（`getServerSession` が null または `requireSession` が error を返す）
- **操作**: 認証が必要なエンドポイント（例: `GET /api/projects`）を未認証状態で呼び出す
- **期待結果**: HTTP 401 が返る
- **根拠**: 認証ルール全般
- **Truth Matrix ID**: TM-AUTH-001
- **実装ファイル**: src/app/api/projects/projects.test.ts L96-107, src/app/api/users/users.test.ts L78-89
- **実装状態**: 実装済み

---

## 8. 進捗率 (Progress Rate)

### APP-PRG-001: 進捗率算出 - Done=50%, Confirmed=100%, 他=0% の平均
- **レイヤー**: Application Integration
- **前提条件**: `prisma.project.findMany` が `[{ status: 'DONE' }, { status: 'CONFIRMED' }, { status: 'OPEN' }]` のような issues を持つ project を返すようモックする
- **操作**: `listProjects({ page: 1, limit: 10 })` を呼び出す
- **期待結果**: `result.items[0].progressRate === 50`（(50 + 100 + 0) / 3 = 50）
- **根拠**: docs/phase0_plan.md §0.7 / TM-PRG-001
- **Truth Matrix ID**: TM-PRG-001
- **実装ファイル**: src/application/queries/list-projects.test.ts L53-71
- **実装状態**: 実装済み

### APP-PRG-002: 指摘 0 件のプロジェクトの進捗率は 0%（境界値）
- **レイヤー**: Application Integration
- **前提条件**: `prisma.project.findMany` が issues が空配列のプロジェクトを返すようモックする
- **操作**: `listProjects({ page: 1, limit: 10 })` を呼び出す
- **期待結果**: `result.items[0].progressRate === 0`
- **根拠**: docs/phase0_plan.md §0.7 / TM-PRG-002
- **Truth Matrix ID**: TM-PRG-002
- **実装ファイル**: src/application/queries/list-projects.test.ts L73-85
- **実装状態**: 実装済み

### APP-PRG-003: Worker ロールでは自身担当の Issue のみで進捗率を算出する
- **レイヤー**: Application Integration
- **前提条件**: `prisma.project.findMany` をスパイし、呼び出し引数を記録するようモックする
- **操作**: `listProjects({ page: 1, limit: 10 }, 'WORKER', undefined, 'worker-id')` を呼び出す
- **期待結果**: `findMany` の `where` 引数に `{ issues: { some: { assignee_id: 'worker-id' } } }` が含まれる
- **根拠**: docs/phase0_plan.md §0.9 / TM-PRG-004
- **Truth Matrix ID**: TM-PRG-004, TM-PRG-005
- **実装ファイル**: src/application/queries/list-projects.test.ts L87-107
- **実装状態**: 実装済み

### APP-PRG-004: Supervisor ロールでは自支部の Project のみ取得される
- **レイヤー**: Application Integration
- **前提条件**: `prisma.project.findMany` をスパイするようモックする
- **操作**: `listProjects({ page: 1, limit: 10 }, 'SUPERVISOR', 'branch-id')` を呼び出す
- **期待結果**: `findMany` の `where` 引数に `{ branch_id: 'branch-id' }` が含まれる
- **根拠**: docs/phase0_plan.md §0.9 / TM-PRG-005
- **Truth Matrix ID**: TM-PRG-005
- **実装ファイル**: src/application/queries/list-projects.test.ts L109-125
- **実装状態**: 実装済み

### APP-PRG-005: 進捗率は Query 時に算出され DB には保存されない
- **レイヤー**: Application Integration
- **前提条件**: `prisma.project.findMany` が Done の Issue を含むプロジェクトを返すようモックし、`prisma.project.update` をスパイする
- **操作**: `listProjects({ page: 1, limit: 10 })` を呼び出す
- **期待結果**: `result.items[0].progressRate === 50` であり、かつ `prisma.project.update` が呼ばれない
- **根拠**: CLAUDE.md CQRS設計 / TM-PRG-003
- **Truth Matrix ID**: TM-PRG-003
- **実装ファイル**: src/application/queries/list-projects.test.ts L127-142
- **実装状態**: 実装済み
- **備考**: TM-PRG-003 は PARTIAL 判定。進捗率の DB 非保存について仕様書での明示記述が弱い

---

## 9. Project

### API-PRJ-001: GET /api/projects - 全ロールでアクセス可能（正常系）
- **レイヤー**: API Route
- **前提条件**: Admin または Worker ロールのセッションをモックする
- **操作**: `GET /api/projects` を呼び出す
- **期待結果**: HTTP 200 が返る
- **根拠**: docs/api-design.md TM-API-007 / TM-PRJ-002
- **Truth Matrix ID**: TM-PRJ-001, TM-PRJ-002
- **実装ファイル**: src/app/api/projects/projects.test.ts L70-94
- **実装状態**: 実装済み

### API-PRJ-002: GET /api/projects - 未認証リクエストで 401 が返る
- **レイヤー**: API Route
- **前提条件**: `requireSession` が `{ error: 401 }` を返すようモックする
- **操作**: `GET /api/projects` を呼び出す
- **期待結果**: HTTP 401 が返る
- **根拠**: 認証ルール全般
- **Truth Matrix ID**: TM-PRJ-002
- **実装ファイル**: src/app/api/projects/projects.test.ts L96-107
- **実装状態**: 実装済み

### API-PRJ-003: GET /api/projects - ページネーションパラメータを受け付ける
- **レイヤー**: API Route
- **前提条件**: Admin セッションをモックする
- **操作**: `GET /api/projects?page=2&limit=5` を呼び出す
- **期待結果**: HTTP 200 が返る
- **根拠**: docs/api-design.md TM-API-007
- **Truth Matrix ID**: TM-PRJ-001
- **実装ファイル**: src/app/api/projects/projects.test.ts L109-120
- **実装状態**: 実装済み

### API-PRJ-004: PATCH /api/projects/{id}/issues/{issueId}/status - PascalCase のステータスが受け付けられる
- **レイヤー**: API Route
- **前提条件**: Worker ロールのセッションをモックし、`updateIssueStatus.execute` が正常終了するようモックする
- **操作**: `PATCH /api/projects/p1/issues/i1/status` に `{ status: 'InProgress' }` (PascalCase) を送信する
- **期待結果**: HTTP 200 が返り、`handler.execute` が `{ newStatus: 'IN_PROGRESS' }` を含む引数で呼ばれる
- **根拠**: docs/api-design.md（ステータス形式変換）/ TM-API-016
- **Truth Matrix ID**: TM-API-016
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/status/status.test.ts L95-119
- **実装状態**: 実装済み

### API-PRJ-005: PATCH /api/projects/{id}/issues/{issueId}/status - 無効なステータスで 400 が返る
- **レイヤー**: API Route
- **前提条件**: Worker ロールのセッションをモックする
- **操作**: `PATCH /api/projects/p1/issues/i1/status` に `{ status: 'INVALID_STATUS' }` を送信する
- **期待結果**: HTTP 400 が返る
- **根拠**: 入力バリデーション要件
- **Truth Matrix ID**: TM-API-016
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/status/status.test.ts L121-140
- **実装状態**: 実装済み

### API-PRJ-006: POST /api/projects/{id}/issues - multipart/form-data で dueDate なしだと 400 が返る
- **レイヤー**: API Route
- **前提条件**: Admin ロールが設定されている
- **操作**: `POST /api/projects/p1/issues` に multipart/form-data で dueDate を省略して送信する
- **期待結果**: HTTP 400 が返る
- **根拠**: ドメインバリデーション要件（dueDate 必須）
- **Truth Matrix ID**: TM-PRJ-004
- **実装ファイル**: src/app/api/projects/[id]/issues/issues.test.ts L147-172
- **実装状態**: 実装済み
- **備考**: TM-PRJ-004 は MISSING_SPEC 判定。startDate < dueDate バリデーションについての仕様追記推奨

### API-PRJ-007: GET /api/projects/{id}/issues - floorId と status フィルタが動作する
- **レイヤー**: API Route
- **前提条件**: Admin セッションをモックし、`listIssues` がモック値を返すよう設定する
- **操作**: `GET /api/projects/p1/issues?floorId=f1&status=OPEN,IN_PROGRESS` を呼び出す
- **期待結果**: HTTP 200 が返り、`listIssues` が `floorId='f1'` と `status=['OPEN', 'IN_PROGRESS']` を含む引数で呼ばれる
- **根拠**: docs/api-design.md TM-API-012
- **Truth Matrix ID**: TM-API-012
- **実装ファイル**: src/app/api/projects/[id]/issues/issues.test.ts L212-245
- **実装状態**: 実装済み

---

## 10. ドメインモデル共通

### DOM-DOM-001: Location.createFromDbId() で DbId ベースの Location が生成される
- **レイヤー**: Domain Unit
- **前提条件**: なし
- **操作**: `Location.createFromDbId('element-123')` を呼び出す
- **期待結果**: `location.value.type === 'dbId'` かつ `(location.value as DbIdLocation).dbId === 'element-123'` である
- **根拠**: CLAUDE.md ドメインモデル「Location: Value Object」/ TM-DOM-001
- **Truth Matrix ID**: TM-DOM-001
- **実装ファイル**: src/domain/models/location.test.ts L7-18
- **実装状態**: 実装済み

### DOM-DOM-002: Location.createFromWorldPosition() で WorldPosition ベースの Location が生成される
- **レイヤー**: Domain Unit
- **前提条件**: なし
- **操作**: `Location.createFromWorldPosition(1.0, 2.0, 3.0)` を呼び出す
- **期待結果**: `location.value.type === 'worldPosition'` かつ `pos.x === 1.0, pos.y === 2.0, pos.z === 3.0` である
- **根拠**: CLAUDE.md ドメインモデル「Location: Value Object」/ TM-DOM-001
- **Truth Matrix ID**: TM-DOM-001
- **実装ファイル**: src/domain/models/location.test.ts L28-44
- **実装状態**: 実装済み

### DOM-DOM-003: Location.createFromDbId() で空文字を渡すと DomainError がスローされる
- **レイヤー**: Domain Unit
- **前提条件**: なし
- **操作**: `Location.createFromDbId('')` を呼び出す
- **期待結果**: `DomainError` がスローされ、メッセージに `'dbId must not be empty'` が含まれる
- **根拠**: ドメインバリデーション要件 / TM-DOM-001
- **Truth Matrix ID**: TM-DOM-001
- **実装ファイル**: src/domain/models/location.test.ts L21-25
- **実装状態**: 実装済み

### DOM-DOM-004: Location.createFromWorldPosition() で非有限値を渡すと DomainError がスローされる
- **レイヤー**: Domain Unit
- **前提条件**: なし
- **操作**: `Location.createFromWorldPosition(1.0, 2.0, Infinity)` を呼び出す
- **期待結果**: `DomainError` がスローされ、メッセージに `'World position coordinates must be finite numbers'` が含まれる
- **根拠**: ドメインバリデーション要件 / TM-DOM-001
- **Truth Matrix ID**: TM-DOM-001
- **実装ファイル**: src/domain/models/location.test.ts L48-54
- **実装状態**: 実装済み

### DOM-DOM-005: Location.equals() が同値の DbId Location で true を返す
- **レイヤー**: Domain Unit
- **前提条件**: `Location.createFromDbId('elem-1')` で2つの Location インスタンスを生成する
- **操作**: `loc1.equals(loc2)` を呼び出す
- **期待結果**: `true` が返る
- **根拠**: Value Object の等値性 / TM-DOM-001
- **Truth Matrix ID**: TM-DOM-001
- **実装ファイル**: src/domain/models/location.test.ts L57-70
- **実装状態**: 実装済み

### DOM-DOM-006: StatusChangeLog.create() で fromStatus/toStatus が正しく設定されたログが生成される
- **レイヤー**: Domain Unit
- **前提条件**: `StatusChangeLogId.create('log-001')`, `IssueId.create('issue-001')`, `UserId.create('user-001')` を準備する
- **操作**: `StatusChangeLog.create(logId, issueId, IssueStatus.Open, IssueStatus.InProgress, userId, undefined)` を呼び出す
- **期待結果**: `log.fromStatus === IssueStatus.Open` かつ `log.toStatus === IssueStatus.InProgress` である
- **根拠**: docs/phase0_plan.md（StatusChangeLog 子エンティティ）/ TM-DOM-002
- **Truth Matrix ID**: TM-DOM-002
- **実装ファイル**: src/domain/models/status-change-log.test.ts L7-28
- **実装状態**: 実装済み

### DOM-DOM-007: ブランド型による ID 型安全性の確認（MISSING_SPEC 対応）
- **レイヤー**: Domain Unit
- **前提条件**: なし
- **操作**: `IssueId.create('id-001')` と `ProjectId.create('id-001')` を生成し、TypeScript の型チェックで互換性がないことを確認する
- **期待結果**: TypeScript の型チェックでコンパイルエラーになる（IssueId を ProjectId として渡せない）
- **根拠**: src/domain/models/*.ts（ブランド型実装準拠）
- **Truth Matrix ID**: TM-DOM-005
- **実装ファイル**: src/domain/models/issue.test.ts
- **実装状態**: 未実装
- **備考**: TM-DOM-005 は MISSING_SPEC 判定。ブランド型の型安全性を保証する静的テスト（型テスト）の実装が推奨される

---

## 11. アーキテクチャ原則

### APP-ARC-001: Query ハンドラ (listProjects) は Domain 集約を経由せず直接 DB から読み取る
- **レイヤー**: Application Integration
- **前提条件**: `list-projects.ts` のソースコードを読み込む
- **操作**: ソースコードに `Issue.reconstruct` や `Issue.create` が含まれていないことを確認する
- **期待結果**: ソースコードに Domain 集約ファクトリメソッドの呼び出しが含まれない
- **根拠**: CLAUDE.md CQRS「Query（読み取り）: DBから直接読み取り。集約を経由しない」/ TM-ARC-001
- **Truth Matrix ID**: TM-ARC-001
- **実装ファイル**: src/application/queries/list-projects.test.ts L145-162
- **実装状態**: 実装済み

### APP-ARC-002: Command ハンドラ (UpdateIssueStatusHandler) が Domain 集約を経由する
- **レイヤー**: Application Integration
- **前提条件**: `createTestIssue(IssueStatus.Open)` の Issue をモックリポジトリに設定し、`save` をスパイする
- **操作**: `handler.execute({ issueId: 'issue-001', projectId: 'project-001', newStatus: 'IN_PROGRESS', changedBy: 'user-001' })` を呼び出す
- **期待結果**: `issueRepo.save` が1回呼ばれ、保存された Issue の `status` が `IssueStatus.InProgress` である（集約メソッドが呼ばれた証拠）
- **根拠**: CLAUDE.md CQRS「Command（書き込み）: Domain集約を経由」/ TM-ARC-002
- **Truth Matrix ID**: TM-ARC-002
- **実装ファイル**: src/application/commands/issue-commands.test.ts L324-354
- **実装状態**: 実装済み
- **備考**: TM-ARC-002 は CONFLICT 判定。CreateUserHandler など一部のコマンドハンドラが Domain 集約を経由せず prisma を直接参照している（違反あり）。Issue 系コマンドは準拠しているが User 系は違反

### APP-ARC-003: Application 層から Infrastructure への直接依存（レイヤー違反の検知）
- **レイヤー**: Application Integration
- **前提条件**: `delete-organization.ts` のソースコードを読み込む
- **操作**: ソースコードに `import prisma from '../../infrastructure/prisma/prisma-client'` が含まれていることを確認する
- **期待結果**: ソースコードに Infrastructure 層への直接インポートが含まれる
- **根拠**: src/application/commands/delete-organization.ts（実装準拠）
- **Truth Matrix ID**: TM-ARC-003
- **実装ファイル**: src/application/commands/user-commands.test.ts L74-90
- **実装状態**: 実装済み
- **備考**: TM-ARC-003 は CONFLICT 判定。CLAUDE.md は Application → Infrastructure の直接依存を禁止しているが、CreateUserHandler と DeleteOrganizationHandler が違反している。将来の改善対象として明示的にドキュメント化

---

## 12. APIエンドポイント網羅性

### API-API-001: GET /api/buildings - HTTP 200 が返る
- **レイヤー**: API Route
- **前提条件**: 認証済みセッションをモックする
- **操作**: `GET /api/buildings` を呼び出す
- **期待結果**: HTTP 200 が返る
- **根拠**: docs/api-design.md TM-API-001
- **Truth Matrix ID**: TM-API-001
- **実装ファイル**: src/app/api/buildings/buildings.test.ts
- **実装状態**: 未実装（エンドポイント実装は存在するがテストファイルが存在しない）

### API-API-002: GET /api/buildings/{buildingId}/floors - HTTP 200 が返る
- **レイヤー**: API Route
- **前提条件**: 認証済みセッションをモックする
- **操作**: `GET /api/buildings/building-001/floors` を呼び出す
- **期待結果**: HTTP 200 が返る
- **根拠**: docs/api-design.md TM-API-002
- **Truth Matrix ID**: TM-API-002
- **実装ファイル**: src/app/api/buildings/[buildingId]/floors/floors.test.ts
- **実装状態**: 未実装

### API-API-003: POST /api/buildings/{buildingId}/initialize-model - HTTP 200 が返る
- **レイヤー**: API Route
- **前提条件**: Admin または Supervisor セッションをモックする
- **操作**: `POST /api/buildings/building-001/initialize-model` を呼び出す
- **期待結果**: HTTP 200 が返る
- **根拠**: docs/api-design.md TM-API-003
- **Truth Matrix ID**: TM-API-003
- **実装ファイル**: src/app/api/buildings/[buildingId]/initialize-model/initialize-model.test.ts
- **実装状態**: 未実装

### API-API-004: GET /api/viewer/token - HTTP 200 が返る
- **レイヤー**: API Route
- **前提条件**: 認証済みセッションをモックする
- **操作**: `GET /api/viewer/token` を呼び出す
- **期待結果**: HTTP 200 が返り、レスポンスに `token` プロパティが含まれる
- **根拠**: docs/api-design.md TM-API-020
- **Truth Matrix ID**: TM-API-020
- **実装ファイル**: src/app/api/viewer/token/token.test.ts
- **実装状態**: 未実装

### API-API-005: GET /api/auth/me - HTTP 200 が返る
- **レイヤー**: API Route
- **前提条件**: 認証済みセッションをモックする
- **操作**: `GET /api/auth/me` を呼び出す
- **期待結果**: HTTP 200 が返り、ユーザー情報が含まれる
- **根拠**: docs/api-design.md TM-API-021
- **Truth Matrix ID**: TM-API-021
- **実装ファイル**: src/app/api/auth/me/me.test.ts
- **実装状態**: 未実装

### API-API-006: GET /api/photos/{photoId}/url - HTTP 200 が返る
- **レイヤー**: API Route
- **前提条件**: 認証済みセッションをモックする
- **操作**: `GET /api/photos/photo-001/url` を呼び出す
- **期待結果**: HTTP 200 が返り、署名付き URL が含まれる
- **根拠**: docs/api-design.md TM-API-019
- **Truth Matrix ID**: TM-API-019
- **実装ファイル**: src/app/api/photos/[photoId]/url/url.test.ts
- **実装状態**: 未実装

### API-API-007: PATCH /api/organizations/{id} - Admin で組織更新が成功する
- **レイヤー**: API Route
- **前提条件**: Admin セッションをモックし、更新ハンドラが正常終了するようモックする
- **操作**: `PATCH /api/organizations/org-001` に `{ name: '東京支部（更新）' }` を送信する
- **期待結果**: HTTP 200 が返る
- **根拠**: docs/api-design.md TM-API-025 / TM-ORG-006
- **Truth Matrix ID**: TM-API-025, TM-ORG-006
- **実装ファイル**: 未定義（src/app/api/organizations/[id]/organizations-id.test.ts に一部あり）
- **実装状態**: 部分実装
- **備考**: organizations-id.test.ts の内容を確認し、UPDATE 操作のテストが含まれるか確認が必要

### API-API-008: DELETE /api/organizations/{id} - Admin で組織削除が成功する
- **レイヤー**: API Route
- **前提条件**: Admin セッションをモックし、削除ハンドラが正常終了するようモックする
- **操作**: `DELETE /api/organizations/org-001` を呼び出す
- **期待結果**: HTTP 200 が返る
- **根拠**: docs/api-design.md TM-API-026 / TM-ORG-006
- **Truth Matrix ID**: TM-API-026, TM-ORG-006
- **実装ファイル**: src/app/api/organizations/[id]/organizations-id.test.ts
- **実装状態**: 部分実装

### API-API-009: GET /api/assignable-users - 正常に取得できる
- **レイヤー**: API Route
- **前提条件**: Supervisor セッションをモックする
- **操作**: `GET /api/assignable-users` を呼び出す
- **期待結果**: HTTP 200 が返り、ユーザー一覧が含まれる
- **根拠**: docs/api-design.md TM-API-031
- **Truth Matrix ID**: TM-API-031
- **実装ファイル**: src/app/api/assignable-users/assignable-users.test.ts
- **実装状態**: 未実装

### API-API-010: GET /api/buildings/{buildingId}/export-seed-csv - 正常にエクスポートできる（MISSING_SPEC 対応）
- **レイヤー**: API Route
- **前提条件**: 認証済みセッションをモックする
- **操作**: `GET /api/buildings/building-001/export-seed-csv` を呼び出す
- **期待結果**: HTTP 200 が返り、CSV データが含まれる
- **根拠**: src/app/api/buildings/[buildingId]/export-seed-csv/route.ts（実装準拠）
- **Truth Matrix ID**: TM-API-032
- **実装ファイル**: src/app/api/buildings/[buildingId]/export-seed-csv/export-seed-csv.test.ts
- **実装状態**: 未実装
- **備考**: TM-API-032 は MISSING_SPEC 判定。仕様書への追記推奨

### API-API-011: DELETE /api/photos/{photoId} - 写真削除が成功する（MISSING_SPEC 対応）
- **レイヤー**: API Route
- **前提条件**: Supervisor または Admin セッションをモックする
- **操作**: `DELETE /api/photos/photo-001` を呼び出す
- **期待結果**: HTTP 200 が返る
- **根拠**: src/app/api/photos/[photoId]/route.ts（実装準拠）
- **Truth Matrix ID**: TM-API-033
- **実装ファイル**: src/app/api/photos/[photoId]/photo.test.ts
- **実装状態**: 未実装
- **備考**: TM-API-033 は MISSING_SPEC 判定。仕様書への追記推奨（削除権限の明確化が必要）

### API-API-012: PATCH /api/buildings/{buildingId}/floors - フロア情報更新が成功する（MISSING_SPEC 対応）
- **レイヤー**: API Route
- **前提条件**: Admin セッションをモックする
- **操作**: `PATCH /api/buildings/building-001/floors` を呼び出す
- **期待結果**: HTTP 200 が返る
- **根拠**: src/app/api/buildings/[buildingId]/floors/route.ts（実装準拠）
- **Truth Matrix ID**: TM-API-034
- **実装ファイル**: src/app/api/buildings/[buildingId]/floors/floors.test.ts
- **実装状態**: 未実装
- **備考**: TM-API-034 は MISSING_SPEC 判定。仕様書への追記推奨

### API-API-013: POST /api/projects/{id}/issues - Supervisor ロールで multipart/form-data が受け付けられる
- **レイヤー**: API Route
- **前提条件**: Supervisor ロールが設定されている
- **操作**: `POST /api/projects/p1/issues` に multipart/form-data で有効なフィールドと BEFORE 写真を送信する
- **期待結果**: HTTP 201 が返る
- **根拠**: docs/api-design.md TM-API-011 / TM-AUTH-001
- **Truth Matrix ID**: TM-API-011, TM-AUTH-001
- **実装ファイル**: src/app/api/projects/[id]/issues/issues.test.ts L174-209
- **実装状態**: 実装済み

### API-API-014: POST /api/projects/{id}/issues/{issueId}/photos - 不正拡張子で 400 が返る
- **レイヤー**: API Route
- **前提条件**: Worker ロールが設定されている
- **操作**: `POST /api/projects/p1/issues/i1/photos` に `.bmp` ファイルを送信する
- **期待結果**: HTTP 400 が返り、`'Invalid file extension'` が含まれる
- **根拠**: 写真アップロードバリデーション要件
- **Truth Matrix ID**: TM-API-018, TM-PHT-003
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/photos/photos.test.ts L55-77
- **実装状態**: 実装済み

### API-API-015: GET /api/buildings/{buildingId}/element-floor-mapping - HTTP 200 が返る（TM-API-004）
- **レイヤー**: API Route
- **前提条件**: 認証済みセッション（任意のロール）をモックし、`prisma.floor.findMany` が空配列を返すようモックする
- **操作**: `GET /api/buildings/building-001/element-floor-mapping` を呼び出す
- **期待結果**: HTTP 200 が返り、フロアマッピング一覧（配列）がレスポンスに含まれる
- **根拠**: docs/api-design.md §GET /api/buildings/{buildingId}/element-floor-mapping (TM-API-004)
- **Truth Matrix ID**: TM-API-004
- **実装ファイル**: src/app/api/buildings/[buildingId]/element-floor-mapping/element-floor-mapping.test.ts
- **実装状態**: 未実装
- **備考**: 全ロール許可エンドポイント。未認証の場合 401 が返ることも確認が必要

### API-API-016: GET /api/buildings/{buildingId}/element-floor-mapping/{dbId} - HTTP 200 が返る（TM-API-005）
- **レイヤー**: API Route
- **前提条件**: 認証済みセッション（任意のロール）をモックし、`prisma.floor.findFirst` が有効なレコードを返すようモックする
- **操作**: `GET /api/buildings/building-001/element-floor-mapping/element-123` を呼び出す
- **期待結果**: HTTP 200 が返り、単一部材のフロア情報がレスポンスに含まれる
- **根拠**: docs/api-design.md §GET /api/buildings/{buildingId}/element-floor-mapping/{dbId} (TM-API-005)
- **Truth Matrix ID**: TM-API-005
- **実装ファイル**: src/app/api/buildings/[buildingId]/element-floor-mapping/[dbId]/element-floor-mapping-dbid.test.ts
- **実装状態**: 未実装
- **備考**: 存在しない dbId を指定した場合に 404 が返ることも確認が必要

### API-API-017: GET /api/buildings/{buildingId}/sync-levels - HTTP 200 が返る（TM-API-006）
- **レイヤー**: API Route
- **前提条件**: 認証済みセッションをモックし、APS からのレベル情報取得をモックする
- **操作**: `GET /api/buildings/building-001/sync-levels` を呼び出す
- **期待結果**: HTTP 200 が返り、同期されたレベル情報がレスポンスに含まれる
- **根拠**: docs/api-design.md §GET /api/buildings/{buildingId}/sync-levels (TM-API-006)
- **Truth Matrix ID**: TM-API-006
- **実装ファイル**: src/app/api/buildings/[buildingId]/sync-levels/sync-levels.test.ts
- **実装状態**: 未実装
- **備考**: APS 外部依存のモックが必要。外部 API 呼び出し失敗時の 500/502 ハンドリングも確認推奨

### API-API-018: GET /api/projects/{id} - 認証済みで HTTP 200 が返る（TM-API-008）
- **レイヤー**: API Route
- **前提条件**: 認証済みセッション（Admin ロール）をモックし、`getProjectDetail` が有効なプロジェクト DTO を返すようモックする
- **操作**: `GET /api/projects/project-001` を呼び出す
- **期待結果**: HTTP 200 が返り、レスポンスボディに `id`, `name`, `status`, `progressRate` が含まれる
- **根拠**: docs/api-design.md §GET /api/projects/{id} (TM-API-008)
- **Truth Matrix ID**: TM-API-008
- **実装ファイル**: src/app/api/projects/[id]/project-id.test.ts
- **実装状態**: 未実装
- **備考**: 存在しない projectId では 404 が返ること、未認証では 401 が返ることも確認が必要

### API-API-019: PATCH /api/projects/{id} - Admin ロールでプロジェクト更新が成功する（TM-API-010）
- **レイヤー**: API Route
- **前提条件**: Admin ロールのセッションをモックし、`updateProject.execute` が正常終了するようモックする
- **操作**: `PATCH /api/projects/project-001` に `{ name: '更新後プロジェクト', status: 'ACTIVE' }` を JSON ボディで送信する
- **期待結果**: HTTP 200 が返り、レスポンスボディに `{ success: true }` が含まれる
- **根拠**: docs/api-design.md §PATCH /api/projects/{id} (TM-API-010) / TM-AUTH-007
- **Truth Matrix ID**: TM-API-010, TM-AUTH-007
- **実装ファイル**: src/app/api/projects/[id]/project-id.test.ts
- **実装状態**: 未実装
- **備考**: Supervisor/Worker ロールでは 403 が返ることも確認が必要（TM-AUTH-007「Project 作成・更新: Admin 限定」）

### API-API-020: GET /api/projects/{id}/issues/{issueId} - 認証済みで HTTP 200 が返る（TM-API-013）
- **レイヤー**: API Route
- **前提条件**: 認証済みセッション（Admin ロール）をモックし、`getIssueDetail` が有効な Issue DTO を返すようモックする
- **操作**: `GET /api/projects/project-001/issues/issue-001` を呼び出す
- **期待結果**: HTTP 200 が返り、レスポンスボディに `issueId`, `title`, `status`, `photos` が含まれる
- **根拠**: docs/api-design.md §GET /api/projects/{id}/issues/{issueId} (TM-API-013)
- **Truth Matrix ID**: TM-API-013
- **実装ファイル**: src/app/api/projects/[id]/issues/[issueId]/issue-id.test.ts
- **実装状態**: 未実装
- **備考**: 存在しない issueId では 404 が返ること、未認証では 401 が返ることも確認が必要

### API-API-021: GET /api/auth/[...nextauth] - NextAuth.js の GET ハンドラが応答する（TM-API-022）
- **レイヤー**: API Route
- **前提条件**: NextAuth セッションプロバイダーが設定されている
- **操作**: `GET /api/auth/session` を呼び出す（NextAuth のセッション取得エンドポイント）
- **期待結果**: HTTP 200 が返り、セッション情報（認証済みの場合はユーザー情報、未認証の場合は空オブジェクト）がレスポンスに含まれる
- **根拠**: docs/api-design.md §GET/POST /api/auth/[...nextauth] (TM-API-022)
- **Truth Matrix ID**: TM-API-022
- **実装ファイル**: src/app/api/auth/[...nextauth]/route.ts（NextAuth デフォルト実装）
- **実装状態**: 未実装（NextAuth の組み込みハンドラのため単体テストより E2E での確認が適切）
- **備考**: NextAuth.js が管理するエンドポイントのため、ユニット・統合テストよりも E2E テストまたはインテグレーションテストとして確認することを推奨。POST /api/auth/signin, POST /api/auth/signout の動作確認も合わせて実施すること

### API-API-022: PATCH /api/users/{id} - Admin ロールでユーザー情報更新が成功する（TM-API-029）
- **レイヤー**: API Route
- **前提条件**: Admin ロールのセッションをモックし、`updateUser.execute` が正常終了するようモックする
- **操作**: `PATCH /api/users/user-001` に `{ name: '更新後 田中太郎', role: 'SUPERVISOR' }` を JSON ボディで送信する
- **期待結果**: HTTP 200 が返り、レスポンスボディに `{ message: 'User updated' }` が含まれる
- **根拠**: docs/api-design.md §PATCH /api/users/{id} (TM-API-029) / TM-USR-001
- **Truth Matrix ID**: TM-API-029, TM-USR-001
- **実装ファイル**: src/app/api/users/[id]/users-id.test.ts
- **実装状態**: 未実装
- **備考**: Supervisor/Worker ロールでは 403 が返ることも確認が必要（TM-USR-001「ユーザー管理権限: Admin 限定」）

---

## 13. E2E テスト

### E2E-ISS-001: Issue 作成から Done 完了までのフルフロー
- **レイヤー**: E2E
- **前提条件**: Docker（PostgreSQL + MinIO）が起動している。dev server が起動している。Admin ユーザーでログイン済み（`e2e/fixtures/auth.ts` の adminPage を使用）
- **操作**: 1. `/projects` にアクセスする。2. プロジェクトを選択しビューワーを開く。3. 「新規指摘」ボタンをクリックして指摘作成フォームを入力し送信する。4. 作成された Issue を開き「着手」ボタンをクリックする（InProgress に遷移）。5. After 写真をアップロードする。6. 「是正完了」ボタンをクリックする（Done に遷移）
- **期待結果**: 各ステップで適切な HTTP レスポンスが返り、最終的に Issue のステータスが Done になっている
- **根拠**: CLAUDE.md 状態遷移ルール / docs/phase0_plan.md §0.5
- **Truth Matrix ID**: TM-ISS-001, TM-ISS-002, TM-ISS-003, TM-PHT-001
- **実装ファイル**: e2e/issues.spec.ts
- **実装状態**: 実装済み

### E2E-ISS-002: Open → Done 直接遷移の UI 禁止確認
- **レイヤー**: E2E
- **前提条件**: Docker + dev server が起動している。Admin ユーザーでログイン済み。Open 状態の Issue が存在する
- **操作**: Issue 詳細画面で「是正完了」ボタンが表示されないこと、またはクリック時に 422/400/500 相当のエラーが表示されることを確認する
- **期待結果**: Open → Done の直接遷移が UI レベルまたは API レベルでブロックされる
- **根拠**: CLAUDE.md「Open → Done の直接遷移は禁止」/ TM-ISS-008
- **Truth Matrix ID**: TM-ISS-008
- **実装ファイル**: e2e/issues.spec.ts
- **実装状態**: 実装済み

### E2E-AUT-001: Admin ログイン → ダッシュボード表示
- **レイヤー**: E2E
- **前提条件**: Docker + dev server が起動している。シードデータが投入されている
- **操作**: Admin ユーザーのログイン情報でサインインし、`/projects` にアクセスする
- **期待結果**: プロジェクト一覧が表示され、HTTP 200 が返る
- **根拠**: 認証ルール全般
- **Truth Matrix ID**: TM-AUTH-001, TM-PRJ-001
- **実装ファイル**: e2e/auth.spec.ts
- **実装状態**: 実装済み

### E2E-AUT-002: Worker ロールでの表示制限確認
- **レイヤー**: E2E
- **前提条件**: Docker + dev server が起動している。Worker ユーザーでログイン済み（`e2e/fixtures/auth.ts` の workerPage を使用）
- **操作**: `/api/projects` (POST) にアクセスを試みる
- **期待結果**: HTTP 403 が返る
- **根拠**: TM-AUTH-007「Project 作成・更新: Admin 限定」
- **Truth Matrix ID**: TM-AUTH-007, TM-PRJ-002
- **実装ファイル**: e2e/auth.spec.ts
- **実装状態**: 実装済み

### E2E-ORG-001: Admin による組織作成と削除
- **レイヤー**: E2E
- **前提条件**: Docker + dev server が起動している。Admin ユーザーでログイン済み
- **操作**: 1. `POST /api/organizations` で新しい Branch 組織を作成する。2. 作成した組織を `DELETE /api/organizations/{id}` で削除する
- **期待結果**: 作成時 HTTP 201、削除時 HTTP 200 が返る
- **根拠**: TM-ORG-002, TM-ORG-004, TM-ORG-006
- **Truth Matrix ID**: TM-ORG-002, TM-ORG-004, TM-ORG-006
- **実装ファイル**: e2e/admin.spec.ts
- **実装状態**: 実装済み

### E2E-ORG-002: HQ 組織削除不可の確認
- **レイヤー**: E2E
- **前提条件**: Docker + dev server が起動している。Admin ユーザーでログイン済み。HQ 組織の ID が `e2e/fixtures/test-data.ts` に定義されている
- **操作**: `DELETE /api/organizations/{HQ_ID}` を呼び出す
- **期待結果**: HTTP 422 相当のエラーが返る（DomainError）
- **根拠**: TM-ORG-004「HQ 削除不可」
- **Truth Matrix ID**: TM-ORG-004, TM-ORG-001
- **実装ファイル**: e2e/admin.spec.ts
- **実装状態**: 実装済み
- **備考**: TM-ORG-001 は PARTIAL 判定。HQ の初期登録がシーダのみである点の確認が必要

### E2E-PRG-001: 進捗率の表示確認
- **レイヤー**: E2E
- **前提条件**: Docker + dev server が起動している。Admin ユーザーでログイン済み。Done と Confirmed の Issue が存在するプロジェクトがある
- **操作**: `GET /api/projects` でプロジェクト一覧を取得する
- **期待結果**: 各プロジェクトの `progressRate` が正しく計算されている（Done=50%, Confirmed=100% ベース）
- **根拠**: docs/phase0_plan.md §0.7 / TM-PRG-001
- **Truth Matrix ID**: TM-PRG-001, TM-PRG-002, TM-PRG-003
- **実装ファイル**: e2e/projects.spec.ts
- **実装状態**: 実装済み

### E2E-PRJ-001: プロジェクト作成から Issue 登録までのシナリオ
- **レイヤー**: E2E
- **前提条件**: Docker + dev server が起動している。Admin ユーザーでログイン済み
- **操作**: 1. `POST /api/projects` でプロジェクトを作成する。2. `POST /api/projects/{id}/issues` で Issue を作成し BEFORE 写真を添付する
- **期待結果**: プロジェクト作成時 HTTP 201、Issue 作成時 HTTP 201 が返る
- **根拠**: docs/api-design.md TM-API-009, TM-API-011
- **Truth Matrix ID**: TM-API-009, TM-API-011, TM-PRJ-001, TM-PRJ-005
- **実装ファイル**: e2e/projects.spec.ts
- **実装状態**: 実装済み

### E2E-ISS-003: Done → Confirmed 承認フロー（Supervisor/Admin）
- **レイヤー**: E2E
- **前提条件**: Docker + dev server が起動している。Done 状態の Issue が存在する。Supervisor ユーザーでログイン済み
- **操作**: `PATCH /api/projects/{id}/issues/{issueId}/status` に `{ status: 'CONFIRMED' }` を送信する
- **期待結果**: HTTP 200 が返り、Issue のステータスが Confirmed になる
- **根拠**: TM-ISS-005, TM-AUTH-004
- **Truth Matrix ID**: TM-ISS-005, TM-AUTH-004
- **実装ファイル**: e2e/issues.spec.ts
- **実装状態**: 実装済み

### E2E-ISS-004: Confirmed → Open 再指摘フロー（Rejection 写真必須確認）
- **レイヤー**: E2E
- **前提条件**: Docker + dev server が起動している。Confirmed 状態の Issue が存在する。Admin ユーザーでログイン済み
- **操作**: 1. `POST /api/projects/{id}/issues/{issueId}/photos` に Rejection フェーズの写真をアップロードする。2. `PATCH /api/projects/{id}/issues/{issueId}/status` に `{ status: 'OPEN', comment: '再指摘理由' }` を送信する
- **期待結果**: 両ステップで HTTP 200/201 が返り、Issue のステータスが Open になる
- **根拠**: TM-ISS-007, TM-PHT-006（MISSING_SPEC）
- **Truth Matrix ID**: TM-ISS-007, TM-PHT-006
- **実装ファイル**: e2e/issues.spec.ts
- **実装状態**: 実装済み
- **備考**: Rejection 写真なしで再指摘を試みた場合のエラー確認も合わせて実施すること

### E2E-USR-001: Admin によるユーザー作成と論理削除
- **レイヤー**: E2E
- **前提条件**: Docker + dev server が起動している。Admin ユーザーでログイン済み
- **操作**: 1. `POST /api/users` で新しい Worker ユーザーを作成する。2. 作成したユーザーを `DELETE /api/users/{id}` で論理削除する
- **期待結果**: 作成時 HTTP 201、削除時 HTTP 200 が返る。削除後のユーザーは `isActive=false` になる（論理削除）
- **根拠**: TM-USR-001, TM-USR-004
- **Truth Matrix ID**: TM-USR-001, TM-USR-004
- **実装ファイル**: e2e/admin.spec.ts
- **実装状態**: 実装済み

### E2E-USR-002: Email 重複ユーザー作成時のバリデーションエラー
- **レイヤー**: E2E
- **前提条件**: Docker + dev server が起動している。Admin ユーザーでログイン済み。既存ユーザーのメールアドレスが既知
- **操作**: 既存ユーザーと同じメールアドレスで `POST /api/users` を呼び出す
- **期待結果**: HTTP 409 相当のエラーが返る（一意制約違反）
- **根拠**: TM-USR-002（PARTIAL）
- **Truth Matrix ID**: TM-USR-002
- **実装ファイル**: e2e/admin.spec.ts
- **実装状態**: 実装済み
- **備考**: TM-USR-002 は PARTIAL 判定。DB レベルの一意制約のため E2E テストでの確認が必要

---

## 付録: Truth Matrix との対応表

| Truth Matrix ID | 判定 | テストケース ID | 実装状態 |
|----------------|------|--------------|---------|
| TM-ISS-001 | MATCH | DOM-ISS-001, DOM-ISS-005 | 実装済み |
| TM-ISS-002 | MATCH | DOM-ISS-006 | 実装済み |
| TM-ISS-003 | MATCH | DOM-ISS-008, APP-PHT-002 | 実装済み |
| TM-ISS-004 | MATCH | DOM-ISS-010 | 実装済み |
| TM-ISS-005 | MATCH | DOM-ISS-011, E2E-ISS-003 | 実装済み |
| TM-ISS-006 | MATCH | DOM-ISS-012, APP-ISS-001 | 実装済み |
| TM-ISS-007 | MATCH | DOM-ISS-013, APP-ISS-002 | 実装済み |
| TM-ISS-008 | PARTIAL | DOM-ISS-009, APP-ISS-003 | 実装済み |
| TM-ISS-009 | PARTIAL | DOM-ISS-007 | 実装済み |
| TM-ISS-010 | MISSING_SPEC | DOM-ISS-014 | 実装済み（仕様追記推奨） |
| TM-ISS-011 | MATCH | DOM-ISS-001 | 実装済み |
| TM-ISS-012 | MATCH | DOM-ISS-004 | 実装済み |
| TM-PHT-001 | MATCH | APP-PHT-001, APP-PHT-002 | 実装済み |
| TM-PHT-002 | MATCH | DOM-PHT-001, DOM-PHT-002, DOM-PHT-003 | 実装済み |
| TM-PHT-003 | MATCH | APP-PHT-003, DOM-PHT-004 | 実装済み |
| TM-PHT-004 | PARTIAL | APP-PHT-004 | 実装済み |
| TM-PHT-005 | PARTIAL | API-PHT-001 | 実装済み |
| TM-PHT-006 | MISSING_SPEC | APP-PHT-006, APP-PHT-007, E2E-ISS-004 | 実装済み |
| TM-ASG-001 | CONFLICT | API-ASG-001, API-ASG-002 | 実装済み |
| TM-ASG-002 | MATCH | DOM-ISS-005, DOM-ASG-001 | 実装済み |
| TM-ASG-003 | MATCH | APP-ASG-001, APP-ASG-002 | 実装済み |
| TM-ASG-004 | MISSING_SPEC | DOM-ASG-002 | 実装済み（仕様追記推奨） |
| TM-ORG-001 | PARTIAL | E2E-ORG-002 | 実装済み |
| TM-ORG-002 | MATCH | DOM-ORG-001, APP-ORG-004, API-ORG-003 | 実装済み |
| TM-ORG-003 | PARTIAL | APP-ORG-005 | 未実装 |
| TM-ORG-004 | PARTIAL | APP-ORG-001, E2E-ORG-002 | 実装済み |
| TM-ORG-005 | PARTIAL | APP-ORG-002, APP-ORG-003 | 実装済み |
| TM-ORG-006 | MATCH | API-ORG-001, API-ORG-002, API-ORG-003 | 実装済み |
| TM-ORG-007 | PARTIAL | DOM-ORG-001 | 実装済み |
| TM-USR-001 | MATCH | API-USR-001〜007 | 実装済み |
| TM-USR-002 | PARTIAL | E2E-USR-002 | 実装済み |
| TM-USR-003 | PARTIAL | DOM-USR-002 | 実装済み |
| TM-USR-004 | MATCH | DOM-USR-001, API-USR-006 | 実装済み |
| TM-USR-005 | MATCH | APP-USR-001 | 実装済み |
| TM-USR-006 | MATCH | DOM-USR-001 | 実装済み |
| TM-USR-007 | MISSING_SPEC | APP-USR-002 | 実装済み（仕様追記推奨） |
| TM-AUTH-001 | MATCH | API-AUT-001, API-AUT-002 | 実装済み |
| TM-AUTH-002 | MATCH | API-AUT-010, API-AUT-011, API-AUT-015 | 部分実装 |
| TM-AUTH-003 | CONFLICT | API-AUT-007, API-AUT-013, API-AUT-014 | 部分実装 |
| TM-AUTH-004 | MATCH | API-AUT-005, API-AUT-006 | 実装済み |
| TM-AUTH-005 | MATCH | APP-ISS-001 | 実装済み |
| TM-AUTH-006 | MATCH | APP-ISS-002 | 実装済み |
| TM-AUTH-007 | MATCH | API-AUT-003, API-AUT-004 | 実装済み |
| TM-AUTH-008 | PARTIAL | API-AUT-008, API-AUT-009 | 実装済み |
| TM-AUTH-009 | CONFLICT | API-ASG-001, API-ASG-002 | 実装済み |
| TM-PRG-001 | MATCH | APP-PRG-001 | 実装済み |
| TM-PRG-002 | MATCH | APP-PRG-002 | 実装済み |
| TM-PRG-003 | PARTIAL | APP-PRG-005 | 実装済み |
| TM-PRG-004 | MATCH | APP-PRG-003 | 実装済み |
| TM-PRG-005 | MATCH | APP-PRG-003, APP-PRG-004 | 実装済み |
| TM-PRJ-001 | MATCH | API-PRJ-001 | 実装済み |
| TM-PRJ-002 | MATCH | API-AUT-003, API-AUT-004, API-PRJ-001 | 実装済み |
| TM-PRJ-003 | MATCH | API-PRJ-001 | 実装済み |
| TM-PRJ-004 | MISSING_SPEC | API-PRJ-006 | 実装済み（仕様追記推奨） |
| TM-PRJ-005 | MATCH | E2E-PRJ-001 | 実装済み |
| TM-DOM-001 | MATCH | DOM-DOM-001〜005 | 実装済み |
| TM-DOM-002 | MATCH | DOM-DOM-006, APP-ISS-004 | 実装済み |
| TM-DOM-003 | PARTIAL | DOM-ISS-015 | 実装済み |
| TM-DOM-004 | MATCH | DOM-ISS-002 | 実装済み |
| TM-DOM-005 | MISSING_SPEC | DOM-DOM-007 | 未実装 |
| TM-API-001 | MATCH | API-API-001 | 未実装（テストファイル未作成） |
| TM-API-002 | MATCH | API-API-002 | 未実装（テストファイル未作成） |
| TM-API-003 | MATCH | API-API-003 | 未実装（テストファイル未作成） |
| TM-API-004 | MATCH | API-API-015 | 未実装（テストファイル未作成） |
| TM-API-005 | MATCH | API-API-016 | 未実装（テストファイル未作成） |
| TM-API-006 | MATCH | API-API-017 | 未実装（テストファイル未作成） |
| TM-API-007 | MATCH | API-PRJ-001 | 実装済み |
| TM-API-008 | MATCH | API-API-018 | 未実装（テストファイル未作成） |
| TM-API-009 | MATCH | API-AUT-003 | 実装済み |
| TM-API-010 | MATCH | API-API-019 | 未実装（テストファイル未作成） |
| TM-API-011 | MATCH | API-AUT-001, API-API-013 | 実装済み |
| TM-API-012 | MATCH | API-PRJ-007 | 実装済み |
| TM-API-013 | MATCH | API-API-020 | 未実装（テストファイル未作成） |
| TM-API-014 | MATCH | API-AUT-010 | 実装済み |
| TM-API-015 | MATCH | API-AUT-008 | 実装済み |
| TM-API-016 | MATCH | API-PRJ-004, API-PRJ-005 | 実装済み |
| TM-API-017 | MATCH | API-ASG-001, API-ASG-002 | 実装済み |
| TM-API-018 | MATCH | API-AUT-007, API-AUT-013, API-AUT-014, API-API-014 | 部分実装 |
| TM-API-019 | MATCH | API-API-006 | 未実装（テストファイル未作成） |
| TM-API-020 | MATCH | API-API-004 | 未実装（テストファイル未作成） |
| TM-API-021 | MATCH | API-API-005 | 未実装（テストファイル未作成） |
| TM-API-022 | MATCH | API-API-021 | 未実装（E2E での確認推奨） |
| TM-API-023 | MATCH | API-ORG-001, API-ORG-002 | 実装済み |
| TM-API-024 | MATCH | API-ORG-003, API-ORG-004 | 実装済み |
| TM-API-025 | MATCH | API-API-007 | 部分実装 |
| TM-API-026 | MATCH | API-API-008 | 部分実装 |
| TM-API-027 | MATCH | API-USR-001, API-USR-002, API-USR-003 | 実装済み |
| TM-API-028 | MATCH | API-USR-004, API-USR-005 | 実装済み |
| TM-API-029 | MATCH | API-API-022 | 未実装（テストファイル未作成） |
| TM-API-030 | MATCH | API-USR-006, API-USR-007 | 実装済み |
| TM-API-031 | MATCH | API-API-009 | 未実装（テストファイル未作成） |
| TM-API-032 | MISSING_SPEC | API-API-010 | 未実装（仕様追記推奨） |
| TM-API-033 | MISSING_SPEC | API-API-011 | 未実装（仕様追記推奨） |
| TM-API-034 | MISSING_SPEC | API-API-012 | 未実装（仕様追記推奨） |
| TM-ARC-001 | MATCH | APP-ARC-001 | 実装済み |
| TM-ARC-002 | CONFLICT | APP-ARC-002, APP-USR-002 | 実装済み |
| TM-ARC-003 | CONFLICT | APP-ARC-003 | 実装済み |
