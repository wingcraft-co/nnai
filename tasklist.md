# Task List

프로젝트 작업 이력을 날짜별로 짧게 남기는 공유 로그입니다.
누가 작업하든 아래 형식처럼 날짜마다 요약 2줄 정도로 남깁니다.

## 작성 형식

```markdown
## YYYY-MM-DD
- 진행한 주요 작업을 한 문장으로 작성
- 이어서 필요한 맥락이나 후속 작업을 한 문장으로 작성
```

## 작업 로그

## 2026-05-21
- `tasklist.md`를 추가하고 날짜별 작업 요약 로그 형식을 정의함.
- `CLAUDE.md`에도 작업자 이름 없이 날짜별 요약 2줄 정도를 남기는 규칙을 추가함.

## 2026-05-22
- 온보딩 페르소나 결과에서 `거침없는 나그네`, `어디서든 현지인`, `용감한 개척자`는 픽셀 캐릭터 밑줄을 숨김.
- `/library` 노마드 카드 컬렉션 MVP를 추가하고, 비로그인 임시 카드는 10초마다 30%까지 흐려지도록 구현함.

## 2026-05-23
- 가이드 페이지에 locale 기반 LLM 응답 언어 강제, 마크다운 URL 자동 링크화, 이미지 우클릭 방지, 로딩 UI 개선 등 다수 UX 개선 적용.
- 무료 사용자 맞춤보고서 이미지에 우클릭/드래그/iOS 롱프레스 저장 차단 추가 (`pointerEvents`, `WebkitTouchCallout` 등), `feature-flags.ts` 신규 추가.
- 타로 결과 lightbox의 "Google로 계속하기" 버튼 OAuth 버그 수정: `return_to`를 현재 result 페이지 URL로 변경하고, `pending_login_city_id`를 sessionStorage에 저장 후 OAuth 복귀 시 lightbox 자동 복원.
- `TarotDeck.tsx`에 OAuth 복귀 후 lightbox 재오픈 useEffect 추가 — 로그인 완료 후 선택했던 도시 카드로 자동으로 돌아옴.
- 유료 Step 2 보고서 강화 제안서(`cowork/marketing/paid-report-enhancement.md`) 작성 — 설문 입력이 보고서 섹션에 1:1로 호명되도록 10개 카테고리(A~J) 제안, 무료/유료 분기 표·출력 스키마 확장안·구현 우선순위 포함.

## 2026-05-24
- 보관함 카드 REPORT/CARD/LOCKED 카테고리화 + 헤더에 카운트 표시, 한글 도시명 음절 중간 줄바꿈 방지(`break-keep`).
- 가이드 구매 후 보관함의 CARD가 REPORT로 승격되도록 `mergeLibraryCards` 수정, 회귀 테스트 추가.
- 보관함→guide 진입 시 `?from=library` 분기 처리(뒤로가기 라벨/목적지). 라이브러리에서 진입할 때 세션 revealedCities[0]로 잘못 fallback되던 버그 수정.
- 국기 이모지 lookup 테이블 3종(`TarotDeck`, `TarotReading`, `TarotCard`) 통합 → ISO-2 Regional Indicator 기반 `@/lib/country-flag` 유틸로 일원화 (PY 등 누락 국가가 🌍로 표시되던 문제 해결).
- DB 점검 및 오래된 자료 정리: `scripts/migrate_sqlite_to_pg.py`, `scripts/drop_mobile_tables.sql`, `tests/test_pdf_generator.py`, `IMPLEMENTATION_STATUS.md` 삭제. utils/db.py ↔ db-schema.md 동기화 상태 확인.
- 타로 세션 PostgreSQL 마이그레이션: `tarot_sessions` 테이블 신설 (TTL 24시간, lazy cleanup, `SELECT FOR UPDATE` 동시성 처리). `api/tarot_session.py`의 in-memory `_sessions` 딕셔너리 제거 → Railway 재배포 시 세션 유실 문제 해결. CI에 `test_tarot_session.py` 등록.
