# TFounZ Database Schema & ER Diagram

## Entity-Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Meeting : "hosts"
    User ||--o{ Message : "sends"
    User ||--o{ Attendance : "logs session"
    User ||--o{ ProductionJob : "creates"
    Meeting ||--o{ Message : "contains"
    Meeting ||--o{ Attendance : "tracks"
    Meeting ||--o{ ProductionJob : "produces"

    User {
        ObjectId _id PK
        String name
        String email UK
        String password
        String role "host | participant | admin"
        String refreshTokenHash
        String avatarColor
        String bio
        Date createdAt
    }

    Meeting {
        ObjectId _id PK
        String title
        String description
        String code UK "TFZ-XXXX-XXXX via crypto"
        ObjectId host FK
        String mode "ai-talkshow | live-studio"
        String showFormat
        Object aiPersona "embedded"
        String status "scheduled | live | ended"
        Date scheduledAt
        Date startedAt
        Date endedAt
        ObjectId[] removedUsers FK
        Number rapidFireHighScore
    }

    Message {
        ObjectId _id PK
        ObjectId meeting FK
        ObjectId sender FK
        String senderName
        String senderType "user | ai | system"
        String content "text index"
        String emotion
        String sfxCue
        Boolean isRapidFire
        Date createdAt
    }

    Attendance {
        ObjectId _id PK
        ObjectId meeting FK
        ObjectId user FK
        Date joinedAt
        Date leftAt
        Number durationMinutes
        Number raisedHandCount
        Number messagesSent
        Number rapidFireScore
    }

    ProductionJob {
        ObjectId _id PK
        ObjectId meeting FK
        ObjectId createdBy FK
        String engine "filmy-ai | sounz-ai"
        String instruction
        String voiceId
        String status "processing | completed | failed"
        String remoteFileId
        String remoteOutputFilename
        String proxyDownloadUrl
        Mixed operationsApplied
        Number processingTimeSeconds
        String errorMessage
    }
```

---

## Indexes Configured

1. **`User`**: Unique index on `email` (`{ email: 1 }`).
2. **`Meeting`**:
   - Unique index `{ code: 1 }` for instant show join lookups.
   - Compound index `{ host: 1, createdAt: -1 }` for host dashboard history.
   - Compound index `{ status: 1, scheduledAt: 1 }` for live/scheduled filtering.
3. **`Message`**:
   - Compound index `{ meeting: 1, createdAt: 1 }` for chronological chat loading.
   - Full-text index `{ content: 'text' }` for searching show transcripts (`GET /api/meetings/:id/messages?q=...`).
4. **`Attendance`**:
   - Compound index `{ meeting: 1, user: 1, joinedAt: -1 }` for fast attendance aggregation and open-session resolution.
5. **`ProductionJob`**:
   - `{ meeting: 1, createdAt: -1 }` and `{ createdBy: 1, createdAt: -1 }`.

---

## MongoDB Aggregation Pipelines (Viva Reference)

### 1. MeetLite Attendance Report (`GET /api/meetings/:id/attendance-report`)
- **`$match`**: Filters `Attendance` documents for the target `meeting`.
- **`$addFields`**: Substitutes `$$NOW` when `leftAt` is null (live participant) and calculates `computedMinutes` using `$divide` on `$subtract`.
- **`$group`**: Aggregates per `user`: `firstJoinTime ($min)`, `lastLeaveTime ($max)`, `totalMinutes ($sum)`, `sessionsCount ($sum)`, `raisedHandCount ($sum)`, `messagesSent ($sum)`, `rapidFireScore ($max)`.
- **`$lookup` + `$unwind` + `$project` + `$sort`**: Joins user profile (`name`, `email`, `role`), rounds `totalMinutes` to 2 decimals, and sorts descending by `totalMinutes`.

### 2. Show History Enrichment (`GET /api/meetings/history`)
- **`$match`**: Finds shows hosted by or attended by the current user.
- **`$lookup`**: Joins `users` (host details), `attendances`, `messages`, and `productionjobs`.
- **`$project`**: Computes `uniqueParticipantCount` (`$size` + `$setUnion`), `messageCount`, and `productionJobCount` directly inside MongoDB.

### 3. Admin Platform Analytics (`GET /api/admin/stats`)
- Runs parallel aggregations across `User` (counts by role), `Meeting` (counts & live shows by `showFormat`), `ProductionJob` (counts by engine + status), and `Attendance` (total sessions, studio watch minutes, hands raised).
