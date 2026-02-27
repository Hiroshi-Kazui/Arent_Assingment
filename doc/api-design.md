# API設計

## 共通
- Base URL: `/api`
- 成功: `2xx` + JSON
- 失敗: `{ "error": string, "details"?: string }`
- エラー方針:
  - DomainError -> 400
  - Not Found -> 404
  - その他 -> 500

## Building / Floor
### GET `/api/buildings`
- Response 200
```json
[
  {
    "buildingId": "uuid",
    "name": "Aビル",
    "address": "Tokyo, Japan",
    "latitude": "35.6762",
    "longitude": "139.7674",
    "modelUrn": "..."
  }
]
```

### GET `/api/buildings/{buildingId}/floors`
- Response 200
```json
[
  {
    "floorId": "uuid",
    "name": "1F",
    "floorNumber": 1,
    "issueCount": 3
  }
]
```

## Project
### GET `/api/projects`
- Response 200
```json
[
  {
    "projectId": "uuid",
    "name": "Aビル新築工事",
    "buildingId": "uuid",
    "status": "ACTIVE",
    "issueCount": 10,
    "startDate": "2026-02-27T00:00:00.000Z",
    "dueDate": "2026-05-28T00:00:00.000Z"
  }
]
```

### GET `/api/projects/{id}`
- Response 200
```json
{
  "projectId": "uuid",
  "name": "Aビル新築工事",
  "buildingId": "uuid",
  "status": "ACTIVE",
  "startDate": "2026-02-27T00:00:00.000Z",
  "dueDate": "2026-05-28T00:00:00.000Z",
  "building": {
    "buildingId": "uuid",
    "name": "Aビル",
    "address": "Tokyo, Japan",
    "modelUrn": "..."
  }
}
```

## Viewer
### GET `/api/viewer/token`
- Response 200
```json
{
  "access_token": "...",
  "expires_in": 3600
}
```

## Issue
### GET `/api/projects/{id}/issues?floorId={floorId}`
- Response 200
```json
[
  {
    "issueId": "uuid",
    "title": "手すり固定不良",
    "issueType": "quality",
    "status": "OPEN",
    "priority": "MEDIUM",
    "locationType": "worldPosition",
    "worldPositionX": 12.3,
    "worldPositionY": 45.6,
    "worldPositionZ": 78.9,
    "dbId": null,
    "reportedBy": "田中",
    "createdAt": "2026-02-27T00:00:00.000Z"
  }
]
```

### POST `/api/projects/{id}/issues`
- Request
```json
{
  "floorId": "uuid",
  "title": "手すり固定不良",
  "description": "アンカー不足",
  "issueType": "quality",
  "locationType": "dbId",
  "dbId": "12345",
  "reportedBy": "田中"
}
```
- Response 201
```json
{ "issueId": "uuid" }
```

### GET `/api/projects/{id}/issues/{issueId}`
- Response 200
```json
{
  "issueId": "uuid",
  "projectId": "uuid",
  "title": "手すり固定不良",
  "description": "アンカー不足",
  "status": "OPEN",
  "locationType": "dbId",
  "dbId": "12345",
  "floorId": "uuid",
  "photos": []
}
```

### PATCH `/api/projects/{id}/issues/{issueId}/status`
- Request
```json
{ "status": "InProgress" }
```
- Accepted values: `Open | InProgress | Done`（互換として `OPEN | IN_PROGRESS | DONE` も許可）
- Response 200
```json
{ "message": "Status updated successfully" }
```

### POST `/api/projects/{id}/issues/{issueId}/photos`
- Content-Type: `multipart/form-data`
- Fields:
  - `file`: binary
  - `photoPhase`: `BEFORE | AFTER`
- Response 201
```json
{
  "photoId": "uuid",
  "blobKey": "projects/{projectId}/issues/{issueId}/photos/{photoId}.jpg"
}
```

## Photo
### GET `/api/photos/{photoId}/url`
- Response 200
```json
{ "url": "https://...signed-url..." }
```
