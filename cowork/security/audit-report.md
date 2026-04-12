# NNAI 보안 감사 보고서

> 감사일: 2026-04-13
> 감사 범위: 전체 (Backend FastAPI + Frontend Next.js)
> 방법론: OWASP Top 10, 코드 정적 분석, 인프라 설정 검토

---

## 요약

| 심각도 | 건수 |
|--------|:----:|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 3 |
| LOW | 4 |
| INFO | 3 |
| **합계** | **11** |

---

## 상세 결과

### [HIGH] H-01: LLM API 엔드포인트에 Rate Limiting 없음

**파일:** `server.py` — `/api/recommend`, `/api/detail`

**설명:**
`/api/recommend`와 `/api/detail`은 호출할 때마다 Gemini LLM API를 호출한다. 인증 없이도 접근 가능한 구조이고 (`extract_user_id` 실패 시에도 요청이 통과됨), rate limiting 미들웨어가 전혀 없다.
악의적인 사용자가 무제한 반복 호출 시 Gemini API 비용이 무한정 증가하고, 서비스 응답 속도 저하 발생.

**재현:**
```bash
for i in {1..100}; do curl -X POST https://api.nnai.app/api/recommend -d '{"nationality":"Korean",...}' & done
```

**조치:**
- slowapi 또는 fastapi-limiter 적용 (`pip install slowapi`)
- IP당 분당 10회 제한 권장
```python
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)
@app.post("/api/recommend")
@limiter.limit("10/minute")
async def api_recommend(request: Request, ...):
```

---

### [MEDIUM] M-01: OAuth CSRF 방어 미흡 (state 파라미터 미검증)

**파일:** `api/auth.py:37`

**설명:**
`google_login()`에서 authorization URL 생성 시 `state` 파라미터를 버리고 있다.
```python
uri, _ = client.create_authorization_url(GOOGLE_AUTH_URL)  # _ = state 버림
```
OAuth 2.0 CSRF 공격에서 `state`는 요청과 콜백을 연결하는 유일한 방어선이다. 없으면 공격자가 피해자를 자신의 계정으로 로그인시키는 Login CSRF 공격이 가능하다.

**조치:**
```python
import secrets
# login 시
state = secrets.token_urlsafe(32)
uri, _ = client.create_authorization_url(GOOGLE_AUTH_URL, state=state)
# state를 세션/쿠키에 저장
response.set_cookie("oauth_state", state, httponly=True, secure=True, max_age=600)

# callback 시
expected = request.cookies.get("oauth_state")
if not expected or request.query_params.get("state") != expected:
    return RedirectResponse("/?auth_error=csrf")
```

---

### [MEDIUM] M-02: 파일 업로드 검증 미흡

**파일:** `api/mobile_uploads.py:29-37`

**설명:**
- 파일 크기 제한 없음 — 수백 MB 파일 업로드 가능
- 허용 확장자 allowlist 없음 (`.php`, `.py`, `.sh` 등 실행 파일도 업로드 가능)
- 확장자만 검사하고 MIME type 미검증 (파일 내용 기반 검증 없음)
- `/tmp`에 저장 — Railway 재시작 시 소실 (UX 이슈이기도 함)

**조치:**
```python
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_SIZE = 5 * 1024 * 1024  # 5MB

ext = os.path.splitext(file.filename)[1].lower()
if ext not in ALLOWED_EXTENSIONS:
    raise HTTPException(422, "지원하지 않는 파일 형식")

data = file.file.read()
if len(data) > MAX_SIZE:
    raise HTTPException(413, "파일 크기 초과 (최대 5MB)")
```

---

### [MEDIUM] M-03: 입력값 길이 제한 없음 (LLM Prompt Injection 위험)

**파일:** `server.py:154+`, `prompts/builder.py`

**설명:**
`/api/recommend`의 `RecommendRequest` 모델에 필드 길이 제한이 없다. `lifestyle`, `preferred_countries`, `immigration_purpose` 등에 매우 긴 문자열이나 프롬프트 주입 패턴을 삽입 가능.

**조치:**
```python
from pydantic import BaseModel, Field

class RecommendRequest(BaseModel):
    nationality: str = Field(max_length=100)
    immigration_purpose: str = Field(max_length=500)
    lifestyle: list[str] = Field(max_items=10)
    # ...
```

---

### [LOW] L-01: SECRET_KEY 기본값 설정

**파일:** `api/auth.py:19`

**설명:**
```python
_SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
```
환경변수 미설정 시 예측 가능한 기본값 사용. 서버사이드 세션 서명에 사용되므로, 공격자가 기본값을 알면 임의 세션 토큰 위조 가능.

**조치:**
기본값 제거 후 미설정 시 서버 시작 실패 처리:
```python
_SECRET_KEY = os.environ["SECRET_KEY"]  # 없으면 KeyError로 즉시 실패
```

---

### [LOW] L-02: DB 단일 연결, 재연결 로직 없음

**파일:** `utils/db.py:486-497`

**설명:**
전역 싱글톤 `_conn` 하나로 모든 요청 처리. PostgreSQL 연결이 끊기면 (Railway 재시작, 네트워크 순단) `get_conn()`은 끊긴 연결을 반환하고 이후 모든 DB 쿼리가 실패.

**조치:**
```python
def get_conn():
    global _conn
    try:
        if _conn is None or _conn.closed:
            _conn = init_db()
        _conn.isolation_level  # ping — 연결 살아있는지 확인
    except psycopg2.OperationalError:
        _conn = init_db()  # 재연결
    return _conn
```
중장기적으로는 `psycopg2.pool.ThreadedConnectionPool` 사용 권장.

---

### [LOW] L-03: JWT_SECRET 미설정 시 빈 문자열

**파일:** `utils/mobile_auth.py:10`

**설명:**
```python
JWT_SECRET = os.environ.get("JWT_SECRET", "")
```
환경변수 미설정 시 빈 문자열. `create_jwt()`는 `MobileAuthError`를 발생시키지만, 일부 JWT 라이브러리는 빈 문자열 secret으로 토큰을 발급/검증한다.

**조치:** `SECRET_KEY`와 동일하게 `os.environ["JWT_SECRET"]`으로 변경.

---

### [LOW] L-04: 쿠키 path 미지정

**파일:** `api/auth.py:72-74`

**설명:**
세션 쿠키에 `path` 미지정 → 기본값 `/` 적용. 현재는 문제없지만, 추후 서브경로별 다른 세션 정책이 필요할 때 혼란 야기 가능.

---

### [INFO] I-01: .env 파일 git 추적 여부

`git ls-files`에 `.env`가 표시됨. 현재 `.env.example`만 포함되어 있고 실제 `.env`는 포함되지 않음 — 정상. 단, `.env`는 `.gitignore`에 포함되어 있어 안전.

---

### [INFO] I-02: CORS 설정 양호

`allow_origins`에 명시적 목록 사용, `allow_credentials=True`. 와일드카드(`*`) 미사용. 현재 설정 적절.

---

### [INFO] I-03: SQL Injection 없음

검토한 모든 DB 쿼리 (`pins.py`, `auth.py`, `db.py`, `mobile_*.py`)가 parameterized query 사용. f-string으로 쿼리를 조합하는 패턴 없음. 안전.

---

## OWASP Top 10 매핑

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| A01 | Broken Access Control | 주의 | rate limiting 없음 (H-01) |
| A02 | Cryptographic Failures | 양호 | itsdangerous 서명, JWT |
| A03 | Injection | 양호 | parameterized query 전체 사용 |
| A04 | Insecure Design | 주의 | OAuth CSRF state 미검증 (M-01) |
| A05 | Security Misconfiguration | 주의 | SECRET_KEY 기본값 (L-01) |
| A06 | Vulnerable Components | 양호 | 최신 버전 유지 중 |
| A07 | Auth Failures | 주의 | DB 재연결 없음 (L-02) |
| A08 | Software Integrity | 양호 | |
| A09 | Logging & Monitoring | 미흡 | 보안 이벤트 별도 로깅 없음 |
| A10 | SSRF | 해당없음 | 내부 URL 패치 없음 |

---

## 우선순위별 조치 계획

```
즉시 (Day 1):
  H-01: slowapi rate limiting 적용 (/api/recommend, /api/detail)
  M-01: OAuth state 파라미터 생성 및 검증 추가
  L-01: SECRET_KEY, JWT_SECRET 기본값 제거

Week 1:
  M-02: 파일 업로드 크기/확장자 검증
  M-03: Pydantic 입력 길이 제한
  L-02: DB 재연결 로직

장기:
  DB connection pool 도입
  보안 이벤트 로깅 (로그인 실패, rate limit 초과 등)
```
