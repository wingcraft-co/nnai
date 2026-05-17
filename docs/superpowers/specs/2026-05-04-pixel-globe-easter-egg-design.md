# Pixel Globe Easter Egg Design

## Summary

지구본 이스터에그를 기존 Nomad Journey 기능의 귀여운 픽셀 게임기 버전으로 재설계한다.

사용자는 랜딩의 픽셀 지구본을 눌러 큰 픽셀 지구본 모달을 열고, 대륙 -> 국가 -> 도시 순서로 탐색한다. 도시를 선택하거나, 목록에 없는 도시를 검색해 추가할 수 있다. 저장은 로그인 사용자만 가능하며, GPS 인증 여부와 지원 도시 여부에 따라 깃발 색상이 달라진다.

## Product Intent

이 기능은 추천 퍼널의 주 기능이 아니라 숨겨진 장난감 같은 이스터에그다. 따라서 정보 밀도보다 귀여움, 즉각적인 반응, 수집 욕구가 중요하다. 다만 저장되는 데이터는 실제 사용자 여정 데이터이므로 인증 상태와 데이터 출처는 엄격하게 분리한다.

핵심 감정은 "작은 레트로 게임기에서 내 노마드 월드맵에 깃발을 꽂는 느낌"이다.

## User Flow

1. 사용자가 랜딩 페이지의 픽셀 지구본을 클릭한다.
2. 전체 화면 모달이 열리고 큰 픽셀 지구본이 나타난다.
3. 사용자가 대륙을 선택한다.
4. 선택한 대륙에서 지원 국가 목록이 나타난다.
5. 사용자가 국가를 선택한다.
6. 해당 국가의 NNAI 지원 도시 목록이 먼저 나타난다.
7. 사용자는 지원 도시를 선택하거나, 목록에 없는 도시를 검색한다.
8. 저장 시 로그인하지 않은 사용자는 Google 로그인으로 이동한다.
9. 로그인 사용자는 GPS 인증 상태와 도시 지원 여부에 따라 깃발을 저장한다.

## Visual Direction

선택한 방향은 레트로 게임기 톤이다.

- 배경은 딥 네이비 기반으로 유지한다.
- 모달 중앙에는 기존 일반 지도보다 훨씬 큰 픽셀 지구본을 둔다.
- 대륙/국가/도시는 게임 스테이지 선택처럼 단계적으로 드러난다.
- 버튼과 패널은 8-bit 게임 UI처럼 두꺼운 테두리, 단단한 그림자, 제한된 색상 팔레트를 사용한다.
- 깃발은 작은 픽셀 스프라이트처럼 보이게 하고, 꽂을 때 짧은 드롭/반짝 애니메이션을 준다.
- 기존 NNAI 픽셀 캐릭터와 어울리도록 `image-rendering: pixelated`를 유지한다.

## Flag States

깃발 색상은 저장된 위치의 신뢰 상태를 직접 표현한다.

| 색상 | 조건 | 의미 |
|------|------|------|
| 초록 | 지원 도시 + 로그인 + GPS 인증 | 사용자가 지원 도시 근처에서 인증한 확정 방문 |
| 빨강 | 지원 도시 + 로그인 + GPS 미인증 | 사용자가 직접 선택한 지원 도시 |
| 노랑 | 미지원 도시 + 로그인 + GPS 인증 | 사용자가 GPS로 인증한 신규 후보 도시 |

미로그인 사용자는 지구본 탐색과 도시 선택까지는 가능하지만 깃발 저장은 할 수 없다. 저장 버튼은 Google 로그인으로 이동한다.

## Supported City Saves

지원 도시는 기존 `city_scores.json` 기반 도시다.

지원 도시 저장 요청은 브라우저가 임의 좌표를 보내지 않고 `city_id`를 보낸다. 백엔드는 `city_id`로 canonical city/country/coordinates를 조회한다.

GPS 인증을 받은 지원 도시 저장은 다음 메타데이터를 가진다.

```json
{
  "supported_city_id": "LIS",
  "is_supported_city": true,
  "location_source": "nnai_supported",
  "gps_verified": true,
  "flag_color": "green"
}
```

GPS 인증 없이 선택만 한 지원 도시 저장은 다음 메타데이터를 가진다.

```json
{
  "supported_city_id": "LIS",
  "is_supported_city": true,
  "location_source": "nnai_supported",
  "gps_verified": false,
  "flag_color": "red"
}
```

## Unsupported City Saves

미지원 도시는 사용자가 국가 선택 후 명시적으로 검색한 도시다. 자동완성처럼 매 키 입력마다 geocode를 호출하지 않는다.

미지원 도시 흐름:

1. 사용자가 국가를 선택한다.
2. 지원 도시 목록 아래의 "내 도시가 없어요" 검색을 연다.
3. 사용자가 도시명을 입력하고 검색한다.
4. 프론트엔드는 `POST /api/journey/geocode`를 호출한다.
5. 백엔드는 도시가 선택 국가에 속하는지 검증하고 `geocode_result_id`를 발급한다.
6. 사용자가 GPS 인증을 완료하면 `POST /api/journey/stops`에 `geocode_result_id`를 보낸다.
7. 백엔드는 노란 깃발로 저장한다.
8. 백엔드는 GitHub 이슈 생성 또는 기존 이슈 연결을 시도한다.

미지원 도시는 추천, 비자, 예산, 세금, 도시 상세 데이터로 승격하지 않는다. 저장된 위치는 여정 로그와 데이터 후보 요청으로만 사용한다.

## Backend Data Model

기존 `nomad_journey_stops`에 깃발 상태와 GitHub 이슈 상태를 명시하는 컬럼을 추가한다.

Required new columns:

- `gps_verified BOOLEAN NOT NULL DEFAULT FALSE`
- `flag_color TEXT NOT NULL DEFAULT 'red'`
- `github_issue_url TEXT NULL`
- `github_issue_key TEXT NULL`
- `github_issue_status TEXT NOT NULL DEFAULT 'not_required'`

`flag_color` 값:

- `green`
- `red`
- `yellow`

`github_issue_status` 값:

- `not_required`
- `created`
- `linked`
- `failed`

기존 `line_style`, `supported_city_id`, `is_supported_city`, `location_source`, `geocode_*` 컬럼은 계속 사용한다. `line_style`은 지도 선 렌더링용이고, `flag_color`는 깃발 상태 렌더링용이다.

DDL 변경이 있으므로 `utils/db.py`와 `cowork/backend/db-schema.md`를 같은 작업에서 갱신해야 한다.

## API Contract

### POST /api/journey/stops

지원 도시 요청:

```json
{
  "city_id": "LIS",
  "gps_verified": true,
  "note": "리스본"
}
```

미지원 GPS 인증 도시 요청:

```json
{
  "geocode_result_id": "geo_<signed-result-token>",
  "gps_verified": true,
  "note": "추억"
}
```

Validation rules:

- 로그인하지 않은 사용자는 `401`.
- `city_id`와 `geocode_result_id`는 동시에 보낼 수 없다.
- 미지원 도시는 `gps_verified: true`가 아니면 저장할 수 없다.
- 지원 도시는 `gps_verified`가 없으면 `false`로 취급한다.
- legacy `city/country/lat/lng` 요청은 호환용으로만 유지하고 `flag_color: red`, `gps_verified: false`로 분류한다.

Response includes:

```json
{
  "id": 42,
  "city": "Lisbon",
  "country": "Portugal",
  "country_code": "PT",
  "lat": 38.7223,
  "lng": -9.1393,
  "note": "리스본",
  "supported_city_id": "LIS",
  "is_supported_city": true,
  "location_source": "nnai_supported",
  "line_style": "solid",
  "gps_verified": true,
  "flag_color": "green",
  "github_issue_url": null,
  "github_issue_status": "not_required",
  "created_at": "2026-05-04T00:00:00+00:00"
}
```

API 변경이 있으므로 `cowork/backend/api-reference.md`를 같은 작업에서 갱신해야 한다.

## GitHub Issue Automation

노란 깃발 저장 시 백엔드가 GitHub REST API로 데이터 추가 요청 이슈를 만든다.

Environment variables:

- `GITHUB_TOKEN`
- `GITHUB_REPO`, 예: `wingcraft-co/nnai`
- `GITHUB_CITY_LABEL`, 기본값: `data:city-request`

Issue dedupe key:

```text
city-request:<ISO-2>:<normalized-city-name>
```

권장 이슈 제목:

```text
Add journey city: Granada, Spain
```

권장 이슈 본문:

```markdown
Unsupported journey city was GPS-verified by a user.

- City: Granada
- Country: Spain
- Country code: ES
- Latitude: 37.1773
- Longitude: -3.5986
- Source: nominatim
- Request key: city-request:ES:granada
```

Dedupe behavior:

- 같은 `github_issue_key`의 이슈 URL이 이미 DB에 있으면 새 이슈를 만들지 않고 `github_issue_status: linked`로 저장한다.
- 없으면 GitHub issue search API로 열린 기존 이슈를 찾는다.
- 기존 이슈가 있으면 연결한다.
- 기존 이슈가 없으면 새 이슈를 만든다.
- GitHub 호출 실패는 journey stop 저장을 실패시키지 않는다. 해당 stop은 `github_issue_status: failed`로 저장한다.

토큰이 설정되지 않은 로컬/테스트 환경에서는 GitHub 호출을 건너뛰고 `github_issue_status: failed`가 아니라 `not_required` 또는 테스트 전용 mock 결과로 처리한다. 운영 환경에서는 토큰 누락을 로그로 남긴다.

## Frontend Component Design

주 대상 파일은 `frontend/src/components/journey/NomadJourneyModal.tsx`다.

State model:

- `activeContinent`
- `activeCountryCode`
- `selectedCityId`
- `unsupportedSearchQuery`
- `unsupportedResults`
- `selectedGeocodeResult`
- `gpsState`: `idle | requesting | verified | denied | unavailable`
- `pendingFlagColor`

UI stages:

1. Globe stage: 큰 픽셀 지구본과 대륙 선택 핫스팟
2. Country stage: 선택 대륙의 국가 칩
3. City stage: 지원 도시 리스트와 "내 도시가 없어요" 검색
4. Confirm stage: GPS 인증 버튼, 깃발 미리보기, 저장 버튼

Save behavior:

- 미로그인 상태에서 저장 클릭: Google 로그인으로 이동
- 지원 도시 + GPS verified: `{ city_id, gps_verified: true }`
- 지원 도시 + GPS not verified: `{ city_id, gps_verified: false }`
- 미지원 도시 + GPS verified: `{ geocode_result_id, gps_verified: true }`
- 미지원 도시 + GPS not verified: 저장 불가, GPS 인증 요청 메시지 표시

## Error Handling

- GPS 권한 거부: 지원 도시는 빨간 깃발 저장 가능, 미지원 도시는 저장 불가
- geocode 503: "도시 확인 서버가 잠시 쉬고 있어요" 톤의 메시지 표시
- geocode 결과 없음: 국가를 다시 확인하거나 도시명을 바꿔보라는 메시지 표시
- GitHub 이슈 실패: 사용자에게는 저장 성공을 보여주고, 작은 보조 문구로 "도시 추가 요청은 나중에 다시 시도될 수 있어요" 수준만 표시한다
- 저장 401: 로그인으로 이동

## Analytics

기존 journey analytics에 다음 이벤트를 추가한다.

- `journey_gps_verify_click`
- `journey_gps_verify_success`
- `journey_gps_verify_failure`
- `journey_unsupported_search_submit`
- `journey_unsupported_city_select`
- `journey_flag_save_success` with `{ flag_color, supported, gps_verified }`
- `journey_github_issue_linked` with `{ status }`

이벤트에는 이메일, 이름, 정확한 GPS 원본 좌표 같은 PII를 보내지 않는다.

## Testing

Frontend:

- `frontend/src/lib/journey-map.test.mjs`
  - 지원 국가/도시 drilldown 유지
  - flag color resolver 추가 시 green/red/yellow 조건 테스트
- 컴포넌트 테스트가 가능한 구조라면 저장 payload 분기 테스트
- 최소한 `npm run build`로 타입/빌드 검증

Backend:

- `tests/test_journey_api.py`
  - 지원 도시 + `gps_verified: true` 저장은 green
  - 지원 도시 + `gps_verified: false` 저장은 red
  - 미지원 도시 + `gps_verified: true` 저장은 yellow
  - 미지원 도시 + `gps_verified: false` 저장은 422
  - GitHub issue create 성공 시 URL/status 저장
  - 같은 city issue key는 중복 생성하지 않음
  - GitHub failure는 stop 저장을 롤백하지 않음

DB:

- `tests/test_db.py`
  - 새 컬럼 존재
  - `flag_color` check constraint
  - `github_issue_status` check constraint

Because backend API and DDL change, update:

- `cowork/backend/api-reference.md`
- `cowork/backend/db-schema.md`

If new test files are added, `.github/workflows/main-tests.yml` must include them. If tests are added to existing files already listed in CI, no workflow change is required.

## Open Decisions Resolved

- Visual direction: retro game console
- Save requires login: yes
- Supported city GPS verified color: green
- Supported city without GPS color: red
- Unsupported city requires GPS and uses yellow
- Unsupported yellow city creates a GitHub issue request
- GitHub issues are deduped per city/country
- GitHub automation runs from backend via REST API
