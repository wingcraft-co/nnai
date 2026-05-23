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
