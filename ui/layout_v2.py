"""ui/layout_v2.py — Custom faceted filter tarot card UI (Phase 2 UI)."""
from __future__ import annotations

import json
import os

import gradio as gr

from recommender import recommend_from_db, compute_disabled_options
from api.parser import _inject_visa_urls

# ---------------------------------------------------------------------------
# Field mapping constants (JS chip labels → recommender.py internal keys)
# ---------------------------------------------------------------------------

KRW_TO_USD = 1 / 1350.0  # fixed rate for scoring; currency precision not required here

LIFESTYLE_TAG_MAP = {
    "저물가":     "저비용 생활",
    "코워킹":     "코워킹스페이스 중시",
    "안전":       "안전 중시",
    "한인커뮤니티": "한인 커뮤니티",
    "영어권":     "영어권 선호",
}

TIMELINE_MAP = {
    "90일":  "90일 단기 체험",
    "6개월": "6개월 단기 체험",
    "1년":   "1년 단기 체험",
    "3년+":  "3년 이상 장기 이민",
}

# "기타" expands to two internal continent keys
CONTINENT_MAP_EXPANSION = {
    "기타": ["중동/아프리카", "북미"],
}


def _map_profile(profile: dict) -> dict:
    """Translate JS profile fields to recommend_from_db() field names."""
    # Expand continents: "기타" → ["중동/아프리카", "북미"]
    raw_continents = profile.get("continents") or []
    expanded: list[str] = []
    for c in raw_continents:
        expanded.extend(CONTINENT_MAP_EXPANSION.get(c, [c]))

    # Map lifestyle chip labels
    raw_tags = profile.get("lifestyle_tags") or []
    mapped_lifestyle = [LIFESTYLE_TAG_MAP.get(t, t) for t in raw_tags]

    # Map timeline chip label
    raw_timeline = profile.get("timeline", "")
    mapped_timeline = TIMELINE_MAP.get(raw_timeline, raw_timeline)

    # nationality: "KR" → "한국" for recommend_from_db warning logic
    nationality = profile.get("nationality", "")
    if nationality == "KR":
        nationality = "한국"

    return {
        "income_usd":          (profile.get("monthly_income_krw") or 0) * KRW_TO_USD,
        "preferred_countries": expanded,
        "lifestyle":           mapped_lifestyle,
        "timeline":            mapped_timeline,
        "nationality":         nationality,
    }


def filter_cities(profile_json: str) -> str:
    """
    Gradio API endpoint: filter and rank cities from DB.

    Input:  JSON string with JS profile fields (see spec Section 1)
    Output: JSON string {"top_cities": [...], "disabled_options": {...}}
    """
    profile = json.loads(profile_json)
    db_profile = _map_profile(profile)
    result = recommend_from_db(db_profile, top_n=8)
    _inject_visa_urls(result)
    disabled = compute_disabled_options(db_profile)
    return json.dumps({
        "top_cities": result["top_cities"],
        "disabled_options": disabled,
    }, ensure_ascii=False)


def nomad_advisor_v2(payload_json: str) -> str:
    """
    Gradio API endpoint: run LLM detail guide for 3 selected cities.

    Input:  JSON string {"profile": {...JS fields...}, "selected_cities": ["치앙마이", ...]}
    Output: JSON string {"markdown": "...combined markdown for all 3 cities..."}
    """
    payload = json.loads(payload_json)
    profile = payload.get("profile", {})
    selected_names = payload.get("selected_cities", [])  # city_kr names

    db_profile = _map_profile(profile)
    # Re-add income_krw (만원 단위) for build_detail_prompt() which reads this key
    db_profile["income_krw"] = (profile.get("monthly_income_krw") or 0) // 10000

    # Fetch up to 8 cities from DB to find the selected ones by name
    result = recommend_from_db(db_profile, top_n=8)
    _inject_visa_urls(result)

    # Build lookup by city_kr (Korean name) and city (English name)
    all_cities = result["top_cities"]
    name_to_city = {}
    for c in all_cities:
        name_to_city[c.get("city_kr", "")] = c
        name_to_city[c.get("city", "")] = c

    # Preserve selection order; skip any city not found in DB results
    selected_city_dicts = [name_to_city[n] for n in selected_names if n in name_to_city]

    if not selected_city_dicts:
        return json.dumps({"markdown": "선택된 도시를 찾을 수 없습니다."}, ensure_ascii=False)

    parsed_data = {
        "top_cities":    selected_city_dicts,
        "_user_profile": db_profile,
    }

    # Import lazily to avoid circular import at module load time
    from app import show_city_detail

    markdowns = []
    for i in range(len(selected_city_dicts)):
        md = show_city_detail(parsed_data, city_index=i)
        markdowns.append(md)

    combined = "\n\n---\n\n".join(markdowns)
    return json.dumps({"markdown": combined}, ensure_ascii=False)


def build_ui_html() -> str:
    """Return the full custom HTML/CSS/JS for the faceted filter UI."""
    return """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
/* ── Reset & base ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, 'SF Pro Display', 'Segoe UI', sans-serif;
       background: #f0f4f8; color: #1a1a2e; min-height: 100vh; }
@media (prefers-color-scheme: dark) {
  body { background: #0f0f1a; color: #e0e0f0; }
  .panel { background: rgba(30,30,60,0.72) !important; border-color: rgba(255,255,255,0.12) !important; }
  .chip { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.15); color: #c0c0e0; }
  .chip.active { background: rgba(124,58,237,0.25); border-color: #7c3aed; color: #d0c0ff; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}

/* ── Header ── */
.hdr {
  background: rgba(255,255,255,0.85); backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0,0,0,0.08);
  padding: 16px 24px; position: sticky; top: 0; z-index: 200;
  display: flex; align-items: center; gap: 12px;
}
.hdr h1 { font-size: 1.1rem; font-weight: 700; }
.hdr p  { font-size: 0.8rem; color: #6b7280; }

/* ── Layout ── */
.app-body {
  display: flex; gap: 0; min-height: calc(100vh - 60px);
}

/* ── Left panel — filters ── */
.filter-panel {
  width: 360px; min-width: 320px; max-width: 380px; flex-shrink: 0;
  padding: 20px 16px; overflow-y: auto; border-right: 1px solid rgba(0,0,0,0.06);
}
.panel {
  background: rgba(255,255,255,0.72); backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.5); border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08); margin-bottom: 10px; overflow: hidden;
}
.panel-hdr {
  padding: 12px 16px; cursor: pointer; display: flex; align-items: center;
  justify-content: space-between; user-select: none;
  font-size: 0.85rem; font-weight: 700; color: #374151;
}
.panel-hdr .arrow { transition: transform 0.2s; font-size: 0.75rem; color: #9ca3af; }
.panel.collapsed .panel-hdr .arrow { transform: rotate(-90deg); }
.panel-body { padding: 14px 16px; display: block; }
.panel.collapsed .panel-body { display: none; }
.panel-body label {
  font-size: 0.7rem; font-weight: 600; color: #6b7280;
  text-transform: uppercase; letter-spacing: 0.06em;
  display: block; margin-bottom: 6px; margin-top: 12px;
}
.panel-body label:first-child { margin-top: 0; }

/* ── Slider ── */
input[type=range] {
  width: 100%; accent-color: #7c3aed; height: 4px;
  background: rgba(124,58,237,0.15); border-radius: 2px;
}
.slider-val { font-size: 0.85rem; font-weight: 700; color: #7c3aed; margin-top: 4px; }

/* ── Select / Radio ── */
select {
  width: 100%; padding: 8px 10px; border-radius: 10px;
  border: 1px solid rgba(0,0,0,0.12); background: rgba(255,255,255,0.8);
  font-size: 0.85rem; color: #1a1a2e; outline: none;
}
.radio-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
.radio-row label {
  display: flex; align-items: center; gap: 5px;
  font-size: 0.78rem; font-weight: 500; text-transform: none;
  letter-spacing: 0; color: #374151; cursor: pointer;
  background: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.1);
  border-radius: 20px; padding: 4px 10px;
}
.radio-row input[type=radio] { accent-color: #7c3aed; }

/* ── Chips ── */
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.chip {
  padding: 5px 12px; border-radius: 20px; font-size: 0.78rem;
  border: 1px solid rgba(0,0,0,0.1); background: rgba(255,255,255,0.6);
  color: #374151; cursor: pointer; transition: all 0.15s;
  user-select: none; -webkit-user-select: none;
}
.chip.active { background: rgba(124,58,237,0.12); border-color: #7c3aed; color: #5b21b6; font-weight: 600; }
.chip.disabled { opacity: 0.3; cursor: not-allowed; }
.chip.multi.active { background: rgba(124,58,237,0.12); border-color: #7c3aed; }

/* Conditional companion fields */
#companion-extra { margin-top: 10px; }

/* ── Right panel — card area ── */
.card-area {
  flex: 1; padding: 24px; display: flex; flex-direction: column; align-items: center;
  position: relative;
}
.card-area-header {
  width: 100%; max-width: 600px; display: flex; justify-content: space-between;
  align-items: center; margin-bottom: 16px; min-height: 28px;
}
.selection-banner {
  font-size: 0.9rem; font-weight: 600; color: #7c3aed;
  opacity: 0; transition: opacity 0.4s;
}
.selection-banner.visible { opacity: 1; }
.selection-counter {
  font-size: 0.78rem; color: #6b7280;
  font-variant-numeric: tabular-nums;
}
.loading-spinner {
  width: 16px; height: 16px; border: 2px solid rgba(124,58,237,0.2);
  border-top-color: #7c3aed; border-radius: 50%;
  animation: spin 0.6s linear infinite; display: none;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Card grid ── */
.card-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px; width: 100%; max-width: 600px;
  justify-items: center;
}
@media (max-width: 767px) {
  .app-body { flex-direction: column; }
  .filter-panel { width: 100%; max-width: none; border-right: none; border-bottom: 1px solid rgba(0,0,0,0.06); }
  .card-grid { grid-template-columns: repeat(2, 1fr); }
}

/* ── Tarot cards ── */
.card-wrap {
  width: 90px; perspective: 600px;
  animation: floatCard 3s ease-in-out infinite;
}
.card-wrap:nth-child(odd)  { animation-delay: 0s; }
.card-wrap:nth-child(even) { animation-delay: 1.5s; }
.card-wrap:nth-child(3n)   { animation-delay: 0.8s; }
.card-wrap:nth-child(4n)   { animation-delay: 2.1s; }
@keyframes floatCard {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-8px); }
}
.card-wrap.selected { animation-name: floatCardSelected; }
@keyframes floatCardSelected {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-12px); }
}

.card-inner {
  position: relative; width: 100%; padding-top: 150%;
  transform-style: preserve-3d; transition: transform 0.4s ease;
  border-radius: 14px;
}
.card-wrap.flipped .card-inner { transform: rotateY(180deg); }

.card-face {
  position: absolute; inset: 0; border-radius: 14px;
  backface-visibility: hidden; -webkit-backface-visibility: hidden;
  display: flex; align-items: center; justify-content: center;
  flex-direction: column; gap: 4px;
}
.card-back {
  background: rgba(255,255,255,0.65); backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1.5px solid rgba(124,58,237,0.2);
  box-shadow: 0 8px 24px rgba(124,58,237,0.12), 0 2px 8px rgba(0,0,0,0.06);
  cursor: pointer;
}
.card-back::before {
  content: ''; position: absolute; inset: 6px;
  border: 1px solid rgba(124,58,237,0.15); border-radius: 9px;
}
.card-back .card-symbol { font-size: 1.6rem; opacity: 0.35; }

.card-back.selecting:hover { box-shadow: 0 0 20px rgba(124,58,237,0.35), 0 8px 24px rgba(124,58,237,0.12); }

.card-back.selected-state {
  border-color: #f59e0b;
  box-shadow: 0 0 24px rgba(245,158,11,0.45), 0 8px 24px rgba(0,0,0,0.08);
}

.card-front {
  background: rgba(255,255,255,0.92); backdrop-filter: blur(12px);
  border: 1.5px solid rgba(124,58,237,0.3);
  box-shadow: 0 8px 32px rgba(124,58,237,0.2);
  transform: rotateY(180deg);
  padding: 8px 6px;
}
.card-front .flag  { font-size: 1.8rem; }
.card-front .city  { font-size: 0.65rem; font-weight: 700; color: #374151; text-align: center; }
.card-front .cost  { font-size: 0.6rem; color: #6b7280; margin-top: 2px; }

/* Card enter/exit animations */
@keyframes cardEnter {
  from { opacity: 0; transform: translateY(20px) scale(0.85); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes cardExit {
  to { opacity: 0; transform: scale(0.8); }
}
.card-wrap.entering { animation: cardEnter 0.35s ease-out forwards, floatCard 3s ease-in-out 0.35s infinite; }
.card-wrap.exiting  { animation: cardExit 0.25s ease-in forwards; }

/* ── Empty state ── */
.empty-state {
  text-align: center; padding: 60px 20px; color: #6b7280;
  font-size: 0.9rem; display: none;
}
.empty-state.visible { display: block; }

/* ── Step 2 reveal area ── */
#step2-area { width: 100%; max-width: 600px; }
.step2-btn {
  display: block; width: 100%; padding: 14px;
  background: linear-gradient(90deg, #7c3aed, #2563eb);
  border: none; border-radius: 14px; color: white;
  font-size: 0.95rem; font-weight: 700; cursor: pointer;
  margin-top: 24px; opacity: 0; pointer-events: none;
  transition: opacity 0.4s;
}
.step2-btn.visible { opacity: 1; pointer-events: all; }

/* ── Toast ── */
.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: rgba(30,30,60,0.92); color: white; padding: 10px 20px;
  border-radius: 12px; font-size: 0.82rem; z-index: 999;
  opacity: 0; transition: opacity 0.3s; pointer-events: none;
}
.toast.visible { opacity: 1; }
</style>
</head>
<body>

<div class="hdr">
  <div>
    <h1>노마드 도시 탐색</h1>
    <p>조건을 설정하면 어울리는 도시가 나타납니다</p>
  </div>
</div>

<div class="app-body">

  <!-- ── Left: Filters ── -->
  <div class="filter-panel">

    <!-- 나 -->
    <div class="panel" id="grp-me">
      <div class="panel-hdr" onclick="togglePanel('grp-me')">
        <span>나</span><span class="arrow">▾</span>
      </div>
      <div class="panel-body">
        <label>국적</label>
        <select id="f-nationality" onchange="onChipChange()">
          <option value="KR" selected>🇰🇷 한국</option>
          <option value="US">🇺🇸 미국</option>
          <option value="JP">🇯🇵 일본</option>
          <option value="OTHER">기타</option>
        </select>
        <label style="margin-top:10px;">
          <input type="checkbox" id="f-dual" onchange="onChipChange()" style="accent-color:#7c3aed;">
          복수 국적 보유
        </label>
      </div>
    </div>

    <!-- 소득 -->
    <div class="panel" id="grp-income">
      <div class="panel-hdr" onclick="togglePanel('grp-income')">
        <span>소득</span><span class="arrow">▾</span>
      </div>
      <div class="panel-body">
        <label>월 소득</label>
        <input type="range" id="f-income" min="100" max="1000" step="50" value="300"
               oninput="updateIncomeLabel()" onchange="onSliderChange()">
        <div class="slider-val" id="income-val">300만원 ($2,222)</div>
        <label>소득 증빙 형태</label>
        <div class="chips">
          <span class="chip" data-field="income_proof" data-val="급여명세서" onclick="onSingleChip(this)">급여명세서</span>
          <span class="chip" data-field="income_proof" data-val="사업자등록" onclick="onSingleChip(this)">사업자등록</span>
          <span class="chip active" data-field="income_proof" data-val="무증빙" onclick="onSingleChip(this)">무증빙</span>
        </div>
      </div>
    </div>

    <!-- 동반 -->
    <div class="panel" id="grp-companion">
      <div class="panel-hdr" onclick="togglePanel('grp-companion')">
        <span>동반</span><span class="arrow">▾</span>
      </div>
      <div class="panel-body">
        <label>동반 여부</label>
        <div class="radio-row">
          <label><input type="radio" name="companion" value="혼자" checked onchange="onCompanionChange()"> 혼자</label>
          <label><input type="radio" name="companion" value="배우자" onchange="onCompanionChange()"> 배우자</label>
          <label><input type="radio" name="companion" value="자녀포함" onchange="onCompanionChange()"> 자녀포함</label>
        </div>
        <div id="companion-extra" style="display:none;">
          <label>배우자 소득 (만원/월)</label>
          <input type="range" id="f-spouse-income" min="0" max="500" step="50" value="0"
                 oninput="updateSpouseLabel()" onchange="onSliderChange()">
          <div class="slider-val" id="spouse-val">없음</div>
          <label>자녀 연령대</label>
          <div class="chips">
            <span class="chip multi" data-group="child_age" data-val="영유아" onclick="onMultiChip(this)">영유아</span>
            <span class="chip multi" data-group="child_age" data-val="초등" onclick="onMultiChip(this)">초등</span>
            <span class="chip multi" data-group="child_age" data-val="중고등" onclick="onMultiChip(this)">중고등</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 목적 & 준비도 -->
    <div class="panel" id="grp-purpose">
      <div class="panel-hdr" onclick="togglePanel('grp-purpose')">
        <span>목적 &amp; 준비도</span><span class="arrow">▾</span>
      </div>
      <div class="panel-body">
        <label>이민 목적</label>
        <select id="f-purpose" onchange="onChipChange()">
          <option value="">선택 안 함</option>
          <option value="생활비절감" selected>생활비 절감</option>
          <option value="절세">절세</option>
          <option value="자녀교육">자녀 교육</option>
          <option value="기타">기타</option>
        </select>
        <label>준비 단계</label>
        <div class="radio-row">
          <label><input type="radio" name="stage" value="탐색중" checked onchange="onChipChange()"> 탐색중</label>
          <label><input type="radio" name="stage" value="준비중" onchange="onChipChange()"> 준비중</label>
          <label><input type="radio" name="stage" value="이동예정" onchange="onChipChange()"> 이동예정</label>
        </div>
      </div>
    </div>

    <!-- 체류 조건 -->
    <div class="panel" id="grp-stay">
      <div class="panel-hdr" onclick="togglePanel('grp-stay')">
        <span>체류 조건</span><span class="arrow">▾</span>
      </div>
      <div class="panel-body">
        <label>체류 기간</label>
        <div class="chips">
          <span class="chip" data-field="timeline" data-val="90일" onclick="onSingleChip(this)">90일</span>
          <span class="chip" data-field="timeline" data-val="6개월" onclick="onSingleChip(this)">6개월</span>
          <span class="chip active" data-field="timeline" data-val="1년" onclick="onSingleChip(this)">1년</span>
          <span class="chip" data-field="timeline" data-val="3년+" onclick="onSingleChip(this)">3년+</span>
        </div>
        <label>선호 대륙</label>
        <div class="chips">
          <span class="chip multi active" data-group="continents" data-val="아시아" onclick="onMultiChip(this)">아시아</span>
          <span class="chip multi active" data-group="continents" data-val="유럽" onclick="onMultiChip(this)">유럽</span>
          <span class="chip multi active" data-group="continents" data-val="중남미" onclick="onMultiChip(this)">중남미</span>
          <span class="chip multi active" data-group="continents" data-val="기타" onclick="onMultiChip(this)">기타</span>
        </div>
      </div>
    </div>

    <!-- 라이프스타일 -->
    <div class="panel" id="grp-life">
      <div class="panel-hdr" onclick="togglePanel('grp-life')">
        <span>라이프스타일</span><span class="arrow">▾</span>
      </div>
      <div class="panel-body">
        <label>라이프스타일</label>
        <div class="chips">
          <span class="chip multi" data-group="lifestyle_tags" data-val="저물가" onclick="onMultiChip(this)">저물가</span>
          <span class="chip multi" data-group="lifestyle_tags" data-val="코워킹" onclick="onMultiChip(this)">코워킹</span>
          <span class="chip multi" data-group="lifestyle_tags" data-val="안전" onclick="onMultiChip(this)">안전</span>
          <span class="chip multi" data-group="lifestyle_tags" data-val="한인커뮤니티" onclick="onMultiChip(this)">한인커뮤니티</span>
          <span class="chip multi" data-group="lifestyle_tags" data-val="자연" onclick="onMultiChip(this)">자연</span>
          <span class="chip multi" data-group="lifestyle_tags" data-val="도시" onclick="onMultiChip(this)">도시</span>
          <span class="chip multi" data-group="lifestyle_tags" data-val="비건" onclick="onMultiChip(this)">비건</span>
          <span class="chip multi" data-group="lifestyle_tags" data-val="반려동물" onclick="onMultiChip(this)">반려동물</span>
          <span class="chip multi" data-group="lifestyle_tags" data-val="의료" onclick="onMultiChip(this)">의료</span>
        </div>
        <label>언어 수준</label>
        <div class="radio-row">
          <label><input type="radio" name="lang_level" value="영어가능" checked onchange="onChipChange()"> 영어가능</label>
          <label><input type="radio" name="lang_level" value="현지어조금" onchange="onChipChange()"> 현지어조금</label>
          <label><input type="radio" name="lang_level" value="한국어만" onchange="onChipChange()"> 한국어만</label>
        </div>
      </div>
    </div>

  </div><!-- /filter-panel -->

  <!-- ── Right: Card area ── -->
  <div class="card-area">
    <div class="card-area-header">
      <div class="selection-banner" id="sel-banner" role="status" aria-live="polite">
        ✨ 운명의 도시를 3곳 골라주세요
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="loading-spinner" id="filter-spinner"></div>
        <div class="selection-counter" id="sel-counter" aria-live="polite"></div>
      </div>
    </div>

    <div class="card-grid" id="card-grid"></div>
    <div class="empty-state" id="empty-state">현재 조건에 맞는 도시가 없습니다.<br>필터를 조정해보세요.</div>

    <div id="step2-area">
      <button class="step2-btn" id="step2-btn" onclick="onStep2Click()">
        상세 비자 가이드 보기 →
      </button>
      <div id="step2-result" style="margin-top:20px;"></div>
    </div>
  </div>

</div><!-- /app-body -->

<div class="toast" id="toast"></div>

<script>
// ── State ──────────────────────────────────────────────────────────────────
let state = {
  filters: {
    nationality: 'KR', dual_nationality: false,
    monthly_income_krw: 3000000, income_proof: '무증빙',
    companion_type: '혼자', spouse_income_krw: null, child_age_range: null,
    immigration_purpose: '생활비절감', preparation_stage: '탐색중',
    timeline: '1년',
    continents: ['아시아', '유럽', '중남미', '기타'],
    lifestyle_tags: [], language_level: '영어가능'
  },
  availableCities: [],
  disabledOptions: { continents: [], timeline: [], lifestyle_tags: [] },
  selectedCards: [],
  phase: 'filtering',
  step2Loading: false,
  filterError: false
};

function setState(patch) {
  state = Object.assign({}, state, patch);
  render();
}

// ── Filter reading ──────────────────────────────────────────────────────────
function readFilters() {
  const continents = [...document.querySelectorAll('[data-group="continents"].active')]
    .map(el => el.dataset.val);
  const lifestyle_tags = [...document.querySelectorAll('[data-group="lifestyle_tags"].active')]
    .map(el => el.dataset.val);
  const timeline = document.querySelector('[data-field="timeline"].active')?.dataset.val || '1년';
  const income_proof = document.querySelector('[data-field="income_proof"].active')?.dataset.val || '무증빙';
  const companion_type = document.querySelector('input[name="companion"]:checked')?.value || '혼자';
  const income_slider = parseInt(document.getElementById('f-income').value) * 10000;
  const spouse_income = companion_type !== '혼자'
    ? parseInt(document.getElementById('f-spouse-income').value) * 10000
    : null;
  const child_age_range = [...document.querySelectorAll('[data-group="child_age"].active')]
    .map(el => el.dataset.val);

  return {
    nationality: document.getElementById('f-nationality').value,
    dual_nationality: document.getElementById('f-dual').checked,
    monthly_income_krw: income_slider,
    income_proof,
    companion_type,
    spouse_income_krw: spouse_income,
    child_age_range: child_age_range.length ? child_age_range : null,
    immigration_purpose: document.getElementById('f-purpose').value,
    preparation_stage: document.querySelector('input[name="stage"]:checked')?.value || '탐색중',
    timeline,
    continents,
    lifestyle_tags,
    language_level: document.querySelector('input[name="lang_level"]:checked')?.value || '영어가능'
  };
}

// ── Gradio API call ─────────────────────────────────────────────────────────
const BASE = window.location.pathname.replace(/\\/+$/, '');

async function gradioCall(apiName, payload, signal) {
  const res = await fetch(BASE + '/api/' + apiName, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [JSON.stringify(payload)] }),
    signal
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  return JSON.parse(json.data[0]);
}

// ── Debounce & request cancellation ────────────────────────────────────────
let _filterTimer = null;
let _filterController = null;

function scheduleFilterCall(immediate) {
  clearTimeout(_filterTimer);
  _filterTimer = setTimeout(doFilterCall, immediate ? 0 : 300);
}

async function doFilterCall() {
  // Do not disrupt card reveal or detail view with background filter calls
  if (state.phase === 'revealing' || state.phase === 'detail') return;
  if (_filterController) _filterController.abort();
  _filterController = new AbortController();
  const ctrl = _filterController;

  document.getElementById('filter-spinner').style.display = 'block';
  document.querySelectorAll('.card-wrap').forEach(c => c.style.opacity = '0.6');

  const filters = readFilters();
  setState({ filters, filterError: false });

  try {
    const result = await gradioCall('filter_cities', filters, ctrl.signal);
    if (ctrl.signal.aborted) return;
    setState({
      availableCities: result.top_cities,
      disabledOptions: result.disabled_options,
      selectedCards: [],
      phase: isSelectionReady(filters) ? 'selecting' : 'filtering'
    });
  } catch(e) {
    if (e.name === 'AbortError') return;
    setState({ filterError: true });
    showToast('연결 오류. 잠시 후 다시 시도해주세요.');
  } finally {
    if (!ctrl.signal.aborted) {
      document.getElementById('filter-spinner').style.display = 'none';
      document.querySelectorAll('.card-wrap').forEach(c => c.style.opacity = '');
    }
  }
}

function isSelectionReady(filters) {
  return filters.nationality
    && filters.monthly_income_krw > 0
    && filters.timeline
    && filters.continents.length > 0;
}

// ── UI helpers ──────────────────────────────────────────────────────────────
function togglePanel(id) {
  document.getElementById(id).classList.toggle('collapsed');
}

function onSingleChip(el) {
  const field = el.dataset.field;
  document.querySelectorAll('[data-field="' + field + '"]').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  scheduleFilterCall(true);
}

function onMultiChip(el) {
  if (el.classList.contains('disabled')) return;
  el.classList.toggle('active');
  scheduleFilterCall(true);
}

function onChipChange() { scheduleFilterCall(true); }

let _sliderTimer = null;
function onSliderChange() {
  clearTimeout(_sliderTimer);
  _sliderTimer = setTimeout(() => scheduleFilterCall(true), 300);
}

function onCompanionChange() {
  const v = document.querySelector('input[name="companion"]:checked').value;
  document.getElementById('companion-extra').style.display = v !== '혼자' ? 'block' : 'none';
  scheduleFilterCall(true);
}

function updateIncomeLabel() {
  const v = parseInt(document.getElementById('f-income').value);
  const usd = Math.round(v * 10000 / 1350);
  document.getElementById('income-val').textContent = v + '만원 ($' + usd.toLocaleString() + ')';
}

function updateSpouseLabel() {
  const v = parseInt(document.getElementById('f-spouse-income').value);
  document.getElementById('spouse-val').textContent = v === 0 ? '없음' : v + '만원';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), 3000);
}

// ── Card rendering ──────────────────────────────────────────────────────────
function render() {
  renderBanner();
  renderCards();
  renderDisabled();
  renderCounter();
}

function renderBanner() {
  const banner = document.getElementById('sel-banner');
  const ready = state.phase === 'selecting' || state.phase === 'revealing' || state.phase === 'detail';
  banner.classList.toggle('visible', ready);
}

function renderCounter() {
  const el = document.getElementById('sel-counter');
  if (state.selectedCards.length > 0) {
    el.textContent = state.selectedCards.length + ' / 3 선택됨';
  } else {
    el.textContent = state.availableCities.length + '개 도시';
  }
}

function renderCards() {
  const grid = document.getElementById('card-grid');
  const empty = document.getElementById('empty-state');

  if (state.availableCities.length === 0 && state.phase !== 'detail') {
    grid.innerHTML = '';
    empty.classList.add('visible');
    return;
  }
  empty.classList.remove('visible');

  const existing = new Map();
  grid.querySelectorAll('.card-wrap').forEach(el => {
    existing.set(el.dataset.idx, el);
  });

  const incoming = new Set(state.availableCities.map((_, i) => String(i)));

  // Remove old cards
  existing.forEach((el, idx) => {
    if (!incoming.has(idx)) {
      el.classList.add('exiting');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }
  });

  // Add or update cards
  state.availableCities.forEach((city, i) => {
    const idx = String(i);
    const isSelected = state.selectedCards.includes(i);
    if (existing.has(idx)) {
      const el = existing.get(idx);
      el.querySelector('.card-back').classList.toggle('selected-state', isSelected);
      el.classList.toggle('selected', isSelected);
      // Update front face in case city at this position changed
      const front = el.querySelector('.card-front');
      if (front) {
        front.innerHTML =
          '<span class="flag">' + (city.flag || '') + '</span>' +
          '<span class="city">' + (city.city_kr || city.city) + '</span>' +
          '<span class="cost">$' + (city.monthly_cost_usd || '?') + '/월</span>';
      }
    } else {
      const el = makeCardEl(city, i, isSelected);
      el.style.animationDelay = (i * 0.08) + 's';
      el.classList.add('entering');
      el.addEventListener('animationend', e => {
        if (e.animationName === 'cardEnter') el.classList.remove('entering');
      });
      grid.appendChild(el);
    }
  });
}

function makeCardEl(city, idx, isSelected) {
  const wrap = document.createElement('div');
  wrap.className = 'card-wrap' + (isSelected ? ' selected' : '');
  wrap.dataset.idx = idx;
  wrap.setAttribute('role', 'button');
  wrap.setAttribute('tabindex', '0');
  wrap.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  wrap.setAttribute('aria-label', '도시 카드 ' + (idx + 1));

  const back = document.createElement('div');
  back.className = 'card-back card-face' + (isSelected ? ' selected-state' : '');
  back.innerHTML = '<span class="card-symbol">✦</span>';
  if (state.phase === 'selecting' || state.phase === 'filtering') {
    back.classList.add('selecting');
    wrap.onclick = () => onCardClick(idx);
    wrap.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') onCardClick(idx); };
  }

  const front = document.createElement('div');
  front.className = 'card-front card-face';
  front.innerHTML =
    '<span class="flag">' + (city.flag || '') + '</span>' +
    '<span class="city">' + (city.city_kr || city.city) + '</span>' +
    '<span class="cost">$' + (city.monthly_cost_usd || '?') + '/월</span>';

  const inner = document.createElement('div');
  inner.className = 'card-inner';
  inner.appendChild(back);
  inner.appendChild(front);
  wrap.appendChild(inner);
  return wrap;
}

function renderDisabled() {
  const dis = state.disabledOptions;
  document.querySelectorAll('[data-group="continents"]').forEach(el => {
    const isDisabled = (dis.continents || []).includes(el.dataset.val);
    el.classList.toggle('disabled', isDisabled && !el.classList.contains('active'));
    el.setAttribute('aria-disabled', isDisabled && !el.classList.contains('active') ? 'true' : 'false');
  });
  document.querySelectorAll('[data-field="timeline"]').forEach(el => {
    const isDisabled = (dis.timeline || []).includes(el.dataset.val);
    el.classList.toggle('disabled', isDisabled && !el.classList.contains('active'));
  });
  document.querySelectorAll('[data-group="lifestyle_tags"]').forEach(el => {
    const isDisabled = (dis.lifestyle_tags || []).includes(el.dataset.val);
    el.classList.toggle('disabled', isDisabled && !el.classList.contains('active'));
  });
}

// ── Card selection ──────────────────────────────────────────────────────────
function onCardClick(idx) {
  if (state.phase === 'revealing' || state.phase === 'detail') return;

  const alreadySelected = state.selectedCards.includes(idx);
  let newSelected;

  if (alreadySelected) {
    newSelected = state.selectedCards.filter(i => i !== idx);
  } else {
    if (state.selectedCards.length >= 3) return;
    newSelected = [...state.selectedCards, idx];
  }

  setState({ selectedCards: newSelected });

  const cardEl = document.querySelector('.card-wrap[data-idx="' + idx + '"]');
  if (cardEl) {
    cardEl.style.transform = 'scale(1.08)';
    setTimeout(() => { cardEl.style.transform = ''; }, 200);
    cardEl.setAttribute('aria-pressed', newSelected.includes(idx) ? 'true' : 'false');
  }

  if (newSelected.length === 3) {
    setTimeout(() => startReveal(newSelected), 400);
  }
}

function startReveal(selectedIndices) {
  setState({ phase: 'revealing' });

  const grid = document.getElementById('card-grid');
  const allCards = [...grid.querySelectorAll('.card-wrap')];

  allCards.forEach(el => {
    const idx = parseInt(el.dataset.idx);
    if (!selectedIndices.includes(idx)) {
      el.style.transition = 'opacity 0.2s, transform 0.2s';
      el.style.opacity = '0';
      el.style.transform = 'scale(0.8)';
      setTimeout(() => el.remove(), 250);
    }
  });

  setTimeout(() => {
    grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    grid.style.maxWidth = '360px';
  }, 300);

  selectedIndices.forEach((cityIdx, order) => {
    const cardEl = document.querySelector('.card-wrap[data-idx="' + cityIdx + '"]');
    if (!cardEl) return;
    cardEl.onclick = null;
    cardEl.onkeydown = null;
    setTimeout(() => {
      cardEl.classList.add('flipped');
    }, 1000 + order * 300);
  });

  const totalFlipTime = 1000 + (selectedIndices.length - 1) * 300 + 400 + 100;
  setTimeout(() => {
    const btn = document.getElementById('step2-btn');
    btn.classList.add('visible');
    btn.focus();
  }, totalFlipTime);
}

// ── Step 2 ──────────────────────────────────────────────────────────────────
async function onStep2Click() {
  if (state.step2Loading) return;
  setState({ step2Loading: true, phase: 'detail' });
  document.getElementById('step2-btn').textContent = '로딩 중...';

  const selectedCities = state.selectedCards.map(i => state.availableCities[i].city_kr);
  try {
    const result = await gradioCall('nomad_advisor', {
      profile: state.filters,
      selected_cities: selectedCities
    });
    document.getElementById('step2-result').innerHTML =
      '<div style="white-space:pre-wrap;font-size:0.85rem;line-height:1.7;">' +
      (result.markdown || '결과를 불러올 수 없습니다.') + '</div>' +
      '<button onclick="resetToFiltering()" style="margin-top:20px;padding:10px 20px;' +
      'border:1px solid #7c3aed;border-radius:10px;background:white;color:#7c3aed;' +
      'cursor:pointer;font-weight:600;">처음으로</button>';
  } catch(e) {
    document.getElementById('step2-result').innerHTML =
      '<p style="color:#dc2626;">상세 가이드를 불러올 수 없습니다.' +
      ' <button onclick="onStep2Click()" style="color:#7c3aed;background:none;border:none;cursor:pointer;font-weight:600;">다시 시도</button></p>';
  } finally {
    setState({ step2Loading: false });
    document.getElementById('step2-btn').textContent = '상세 비자 가이드 보기 →';
  }
}

function resetToFiltering() {
  setState({ selectedCards: [], phase: 'selecting', step2Loading: false });
  document.getElementById('step2-result').innerHTML = '';
  document.getElementById('step2-btn').classList.remove('visible');
  // Restore grid layout mutated by startReveal
  const grid = document.getElementById('card-grid');
  grid.style.gridTemplateColumns = '';
  grid.style.maxWidth = '';
  // Un-flip all cards
  document.querySelectorAll('.card-wrap.flipped').forEach(c => c.classList.remove('flipped'));
}

// ── Init ─────────────────────────────────────────────────────────────────────
updateIncomeLabel();
scheduleFilterCall(true);
</script>
</body>
</html>"""


def build_layout_v2(nomad_advisor_fn, show_city_detail_fn) -> gr.Blocks:
    """
    Build and return the Gradio Blocks demo with the custom UI.

    USE_NEW_UI=1 implies USE_DB_RECOMMENDER=1.
    Both filter_cities and nomad_advisor_v2 expose named API endpoints.

    nomad_advisor_fn and show_city_detail_fn are accepted for interface consistency
    with create_layout() in layout.py, but this layout uses module-level functions.
    """
    with gr.Blocks(css="body { margin:0; }") as demo:
        gr.HTML(build_ui_html())

        # Hidden components — sole purpose is Gradio API routing
        filter_input  = gr.Textbox(visible=False)
        filter_output = gr.Textbox(visible=False)
        step2_input   = gr.Textbox(visible=False)
        step2_output  = gr.Textbox(visible=False)

        filter_btn = gr.Button(visible=False)
        step2_btn  = gr.Button(visible=False)

        filter_btn.click(
            filter_cities,
            inputs=filter_input,
            outputs=filter_output,
            api_name="filter_cities",
        )
        step2_btn.click(
            nomad_advisor_v2,
            inputs=step2_input,
            outputs=step2_output,
            api_name="nomad_advisor",
        )

    return demo
