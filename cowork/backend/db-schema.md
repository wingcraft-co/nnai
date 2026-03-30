# NomadNavigator AI — DB Schema Reference

> 프론트엔드 개발자용 데이터베이스 스키마 레퍼런스
> DB: PostgreSQL (Railway)
> 정의 위치: `utils/db.py` → `init_db()`
> 최종 업데이트: 2026-03-30

---

## 테이블 목록

| 테이블 | 설명 |
|--------|------|
| `users` | Google OAuth 로그인 유저 |
| `pins` | 유저가 저장한 관심 도시 |
| `visits` | 경로별 방문자 수 집계 |

---

## users

Google OAuth 콜백 시 자동 upsert됩니다.

```sql
CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,   -- Google OAuth sub (유저 고유 ID)
    email      TEXT,               -- 구글 이메일
    name       TEXT,               -- 구글 이름
    picture    TEXT,               -- 프로필 이미지 URL
    created_at TEXT                -- ISO 8601 타임스탬프 (UTC)
);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | TEXT PK | Google OAuth `sub` 값 |
| `email` | TEXT | 구글 계정 이메일 |
| `name` | TEXT | 구글 계정 이름 |
| `picture` | TEXT | 구글 프로필 이미지 URL |
| `created_at` | TEXT | 최초 로그인 시각 (ISO 8601 UTC) |

**참고:** `ON CONFLICT(id) DO UPDATE` — 재로그인 시 email/name/picture 갱신.

---

## pins

유저가 저장한 관심 도시. `user_id`는 `users.id`를 외래키로 참조합니다.

```sql
CREATE TABLE IF NOT EXISTS pins (
    id         SERIAL PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id),
    city       TEXT NOT NULL,    -- 도시명 (한국어 또는 영어)
    display    TEXT,             -- 표시명 (예: "Bangkok, Thailand")
    note       TEXT,             -- 유저 메모
    lat        REAL NOT NULL,    -- 도시 위도
    lng        REAL NOT NULL,    -- 도시 경도
    user_lat   REAL,             -- 저장 시 유저 위치 위도 (선택)
    user_lng   REAL,             -- 저장 시 유저 위치 경도 (선택)
    created_at TEXT NOT NULL     -- ISO 8601 타임스탬프 (UTC)
);
```

| 컬럼 | 타입 | Null | 설명 |
|------|------|------|------|
| `id` | SERIAL PK | NOT NULL | 자동 증가 정수 ID |
| `user_id` | TEXT FK | NOT NULL | `users.id` 참조 |
| `city` | TEXT | NOT NULL | 도시명 |
| `display` | TEXT | NULL 가능 | 표시용 이름 (예: `"Bangkok, Thailand"`) |
| `note` | TEXT | NULL 가능 | 유저 메모 |
| `lat` | REAL | NOT NULL | 도시 위도 |
| `lng` | REAL | NOT NULL | 도시 경도 |
| `user_lat` | REAL | NULL 가능 | 저장 시점의 유저 위치 위도 |
| `user_lng` | REAL | NULL 가능 | 저장 시점의 유저 위치 경도 |
| `created_at` | TEXT | NOT NULL | 저장 시각 (ISO 8601 UTC) |

---

## visits

경로별 누적 방문 횟수. `POST /api/visits/ping` 호출 시 UPSERT로 관리됩니다.

```sql
CREATE TABLE IF NOT EXISTS visits (
    path       TEXT PRIMARY KEY,       -- 집계 경로 (예: "/dev")
    count      BIGINT NOT NULL DEFAULT 0,  -- 누적 방문 횟수
    updated_at TEXT NOT NULL           -- 마지막 방문 시각 (ISO 8601 UTC)
);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `path` | TEXT PK | 집계 경로 (예: `"/dev"`, `"/"`) |
| `count` | BIGINT | 누적 방문 횟수 (UPSERT로 +1) |
| `updated_at` | TEXT | 마지막 ping 시각 (ISO 8601 UTC) |

**참고:** 유저 인증 없이 집계됩니다. 경로별 독립 집계.

---

## 관계

```
users (id)
  └── pins (user_id) — 1:N

visits — 독립 테이블 (외래키 없음)
```

---

## 연결 정보

| 항목 | 값 |
|------|-----|
| 호스트 | Railway PostgreSQL |
| 환경변수 | `DATABASE_URL` |
| 연결 방식 | 앱 싱글턴 (`utils/db.get_conn()`) |
| autocommit | `False` — 모든 쓰기 후 `conn.commit()` 필요 |
