# NNAI 코드 품질 (Health) 보고서

> 감사일: 2026-04-13
> 감사 범위: Backend (Python) + Frontend (TypeScript)

---

## 요약

| 등급 | 건수 |
|------|:----:|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 4 |
| LOW | 3 |
| INFO | 3 |
| **합계** | **12** |

---

## 상세 결과

### [HIGH] H-01: DB 단일 연결 — 재연결 없음

**파일:** `utils/db.py:486-497`

**설명:**
전역 `_conn` 싱글톤. 연결이 끊기면 모든 API 요청이 실패. Railway는 배포 시 컨테이너를 재시작하는데, 그 사이 DB 연결이 끊기면 서비스가 무한 오류 상태에 빠진다. 현재 `get_conn()`은 `_conn is None` 조건만 체크하고 연결 상태를 확인하지 않는다.

**조치:**
```python
def get_conn():
    global _conn
    try:
        if _conn is None or _conn.closed:
            raise psycopg2.OperationalError("closed")
        _conn.isolation_level  # 연결 alive 확인 (ping)
    except psycopg2.OperationalError:
        _conn = init_db()
    return _conn
```

---

### [HIGH] H-02: 핵심 경로에서 Exception 묵살

**파일:** `api/hf_client.py:42,86,102`, `app.py:33,73`, `api/parser.py:129,365`

**설명:**
LLM 호출, 파싱, 앱 핵심 로직에서 `except Exception` 블록이 에러를 조용히 삼키거나 빈 fallback을 반환. 운영 중 오류 탐지가 불가능하고, 원인 모를 빈 응답이 사용자에게 반환될 수 있다.

```python
# app.py:33 예시 — 에러가 무엇인지 알 수 없음
except Exception:
    return "", [], {}
```

**조치:** 최소한 `logging.exception()` 추가:
```python
import logging
logger = logging.getLogger(__name__)

except Exception:
    logger.exception("LLM 호출 실패")
    return "", [], {}
```
중장기적으로 Sentry 또는 Railway 로그 스트리밍 연결.

---

### [MEDIUM] M-01: api/parser.py 과비대 (705줄, 단일 책임 원칙 위반)

**파일:** `api/parser.py`

**설명:**
705줄 단일 파일이 JSON 파싱, Step1/Step2 마크다운 포맷, 비자 URL 주입, 도시 비교 테이블 생성 등 5개 이상의 책임을 담당. 변경 시 사이드 이펙트 범위가 넓고, 테스트 가독성이 낮다.

**조치 (중기):**
```
api/
  parser/
    __init__.py       # 기존 public API 재export
    json_parser.py    # JSON 파싱만
    markdown.py       # Step1/Step2 마크다운 포맷
    visa_injector.py  # 비자 URL 주입
    compare_table.py  # 도시 비교 테이블
```

---

### [MEDIUM] M-02: utils/db.py 스키마 관리 인라인화 (497줄)

**파일:** `utils/db.py`

**설명:**
`init_db()` 함수 안에 `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS`가 계속 누적되고 있다. 실제 migrations 폴더가 따로 있음에도(`migrations/001~005_*.sql`), `db.py`의 DDL과 분리가 안 되어 있어 실제 DB 상태가 어떤 경로로 적용됐는지 추적 불가.

**조치:**
`init_db()`는 연결만 담당하고, 스키마는 `migrations/` 순차 실행으로 통일. 단기적으로는 최소한 새 컬럼 추가는 `migrations/`에만 기록.

---

### [MEDIUM] M-03: 모바일 API 테스트 커버리지 부족

**파일:** `api/mobile_discover.py(340줄)`, `api/mobile_type_actions.py(614줄)`, `api/mobile_feed.py(224줄)`, `api/mobile_plans.py(191줄)`

**설명:**
최근 main 대비 develop에 1,370줄의 모바일 API가 추가됐지만, 테스트는 `test_mobile_contract_api.py`, `test_mobile_uploads_route.py`, `test_mobile_auth_oauth_payload.py` 3개만 존재. `mobile_discover`의 핵심 로직(피드 필터링, 도시별 discover)은 테스트 없음.

**조치 (우선순위):**
- `test_mobile_discover.py` — city/filter endpoint 핵심 케이스
- `test_mobile_type_actions.py` — like/comment/follow 상태 전환 테스트

---

### [MEDIUM] M-04: api/mobile_type_actions.py 과비대 (614줄)

**파일:** `api/mobile_type_actions.py`

**설명:**
좋아요, 댓글, 팔로우, 저장 등 서로 다른 액션을 하나의 라우터 파일에 몰아넣음. 기능별 분리 필요.

**조치 (중기):**
```
api/mobile_actions/
  likes.py
  comments.py
  follows.py
  saves.py
```

---

### [LOW] L-01: .env.example에 신규 환경변수 누락

**파일:** `.env.example`

**설명:**
현재 `.env.example`에 `JWT_SECRET`, `GEMINI_API_KEY`가 누락되어 있다. 신규 개발자 온보딩 시 혼란 야기.

**현재:**
```
HF_TOKEN=hf_여기에_토큰_입력
USE_DB_RECOMMENDER=1
NEXT_PUBLIC_API_URL=...
DEBUG_MODE=0
```

**추가 필요:**
```
GEMINI_API_KEY=
JWT_SECRET=
DATABASE_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
OAUTH_REDIRECT_URI=
SECRET_KEY=
FRONTEND_URL=
```

---

### [LOW] L-02: 불필요한 DB migration 이중화

**파일:** `utils/db.py` + `migrations/*.sql`

**설명:**
`migrations/001~005_*.sql` 파일이 있지만, `db.py`의 `init_db()`도 동일한 테이블을 생성. 어떤 경로가 실제 적용되는지 불분명. `init_db()`가 먼저 실행되면 migration SQL은 `IF NOT EXISTS`로 무시되는 구조.

---

### [LOW] L-03: `recommender.py` 함수 길이

**파일:** `recommender.py` (추정 1,200줄+, main diff 기준)

**설명:**
recommend 로직이 단일 파일에 집중. 필터링, 스코어링, 폴백 로직이 함수 내에 깊은 중첩으로 구현되어 있을 가능성 높음 (미전체 분석).

---

### [INFO] I-01: TypeScript `any` 타입 사용 없음

프론트엔드 `.tsx`, `.ts` 파일 전체에서 `: any` 패턴 없음. 타입 안전성 양호.

---

### [INFO] I-02: 테스트 커버리지 전반 양호

`tests/` 폴더에 30개 이상의 테스트 파일 존재. 핵심 모듈(parser, recommender, persona, schengen, pins, currency 등)은 커버됨. 신규 모바일 API 커버리지만 보강 필요.

---

### [INFO] I-03: TODO/FIXME 없음

코드 내 `TODO`, `FIXME`, `HACK` 주석 없음. 테스트에서 "하드코딩 금지" 주석 1건은 의도적인 가이드라인.

---

## 우선순위별 조치 계획

```
즉시 (Day 1):
  H-01: DB 재연결 로직 추가
  H-02: 핵심 except 블록에 logging.exception() 추가
  L-01: .env.example 업데이트

Week 1:
  M-03: test_mobile_discover.py, test_mobile_type_actions.py 작성

Week 2-4:
  M-01: api/parser.py 분리
  M-04: api/mobile_type_actions.py 분리
  M-02: db.py DDL 정리 (migration으로 통일)
```
