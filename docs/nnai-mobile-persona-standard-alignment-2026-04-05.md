# nnai-mobile 정렬 가이드 (nnai 표준 우선)

작성일: 2026-04-05
기준 시스템: nnai backend

## 결론

- 사용자 타입의 단일 표준은 `persona_type`입니다.
- `nomad_type`은 더 이상 사용하지 않습니다.
- 모바일은 로그인 후 `GET /api/mobile/profile`의 `persona_type` 값을 기준으로 동작해야 합니다.

## nnai 표준 타입(Enum)

- `schengen_loop`
- `slow_nomad`
- `fire_optimizer`
- `burnout_escape`
- `expat_freedom`
- `null` (아직 퀴즈/추천으로 타입이 저장되지 않은 유저)

## 백엔드 반영 사항

1. DB
- `users.persona_type TEXT` 컬럼 영구 저장

2. 저장 시점
- 웹: 로그인 쿠키가 있는 `POST /api/recommend` 호출에서 요청의 `persona_type` 저장
- 모바일: JWT 인증 `POST /api/mobile/recommend` 호출에서 요청의 `persona_type` 저장

3. 조회 시점
- `GET /api/mobile/profile` 응답에 `persona_type` 반환

## nnai-mobile 수정 필요 항목

1. 타입 정의 교체
- 기존 `nomad_type` 의존 코드 제거
- `persona_type` enum으로 교체

2. 프로필 파싱 교체
- `GET /api/mobile/profile` 파싱 시 `nomad_type` 참조 제거
- `persona_type`을 단일 소스로 사용

3. 분기 로직 교체
- 탭 진입, 카드 노출, 액션 추천 등 타입 기반 분기는 모두 `persona_type` 기준으로 변경

4. 캐시 키/스토리지 키 정리
- 로컬 저장소에서 `nomad_type` 키 사용 중이면 `persona_type`로 마이그레이션

## API 계약 (현재)

### GET /api/mobile/profile

예시:

```json
{
  "uid": "google_uid",
  "name": "홍길동",
  "picture": "https://...",
  "email": "user@example.com",
  "persona_type": "slow_nomad",
  "badges": ["host"],
  "stats": {
    "pins": 3,
    "posts": 1,
    "circles": 2
  }
}
```

### POST /api/mobile/recommend

요청에 `persona_type` 포함 시 저장됩니다.

```json
{
  "nationality": "Korean",
  "income_krw": 500,
  "immigration_purpose": "원격 근무",
  "lifestyle": ["저물가"],
  "languages": ["영어 업무 수준"],
  "timeline": "1년 장기 체류",
  "persona_type": "slow_nomad"
}
```

## 주의사항

- 모바일은 `nomad_type` fallback을 두지 마세요.
- 백엔드/모바일 모두 `persona_type`만 표준으로 사용합니다.
