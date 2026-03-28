"""Internationalization support for NomadNavigator.

Auto-detects browser language: Korean for ko, English for all others.
Injects JS that replaces DOM text after Gradio renders.
"""

# Korean → English text mapping for DOM replacement
I18N_MAP = {
    # Header / subtitle
    "국적 · 소득 · 체류 목적을 입력하면 AI가 최적의 장기 체류 도시를 제안합니다":
        "Enter your nationality, income & stay purpose — AI will recommend optimal cities",

    # Tabs
    "🔍 도시 추천": "🔍 City Recommendations",
    "📖 상세 가이드": "📖 Detailed Guide",

    # Section headings
    "📋 내 프로필 입력": "📋 Enter My Profile",
    "📊 추천 도시 TOP 3": "📊 Top 3 Recommended Cities",

    # Form labels
    "언어 / Language": "Language",
    "국적": "Nationality",
    "여권 발급 국가 기준": "Based on passport issuing country",
    "복수국적 보유 (예: 한국-미국 이중국적)": "Dual citizenship (e.g., Korean-American)",
    "복수국적 보유 시 보조 여권 기준 체류 가능 여부를 추가 안내합니다.":
        "We'll provide additional stay eligibility info based on secondary passport.",
    "동반 여부": "Who's traveling?",
    "혼자 (솔로)": "Solo",
    "배우자·파트너 동반": "With spouse/partner",
    "자녀 동반 (배우자 없이)": "With children (no spouse)",
    "가족 전체 동반 (배우자 + 자녀)": "With family (spouse + children)",
    "자녀 연령대 (해당 항목 모두 선택)": "Children's age groups (select all)",
    "영유아 (7세 이하)": "Toddler (age 7 and under)",
    "초등 (8~13세)": "Elementary (ages 8-13)",
    "중고등 (14~18세)": "Middle/High school (ages 14-18)",
    "배우자/파트너 수입이 있나요?": "Does your spouse/partner have income?",
    "있음": "Yes",
    "없음": "No",
    "배우자 월 수입 (만원)": "Spouse monthly income (₩10k units)",
    "자녀가 20세 이상이며 소득이 있나요?": "Do you have children age 20+ with income?",
    "월 소득 (만원)": "Monthly income (₩10k units)",
    "세전 월 소득 기준. 비자 신청 소득 기준 검토에 사용됩니다.":
        "Gross monthly income. Used for visa income requirement review.",
    "원격근무 계약 형태": "Employment contract type",
    "한국 법인 재직 (재직증명서 + 급여명세서)": "Korean company (employment cert. + payslips)",
    "해외 법인 재직": "Overseas company",
    "프리랜서 (계약서·해외 송금 내역)": "Freelancer (contracts / intl transfers)",
    "1인 사업자 (종합소득세 신고 기반)": "Self-employed (tax returns)",
    "무소득 / 은퇴": "No income / Retired",
    "비자 신청 시 소득 증빙 방식이 신청 가능 비자를 결정합니다.":
        "Your income documentation determines which visas you can apply for.",
    "장기 체류 목적": "Purpose of long-term stay",
    "현재 준비 단계": "Current preparation stage",
    "막연하게 고민 중 (6개월+ 후 실행 예상)": "Still exploring (6+ months out)",
    "구체적으로 준비 중 (3~6개월 내 출국 목표)": "Actively preparing (3-6 months)",
    "이미 출국했거나 출국 임박": "Already abroad or moving very soon",
    "목표 체류 기간": "Target stay duration",
    "90일 이하 (비자 없이 탐색)": "90 days or less (visa-free)",
    "1년 단기 체험": "1-year short-term",
    "3년 장기 체류": "3-year long-term",
    "5년 이상 초장기 체류": "5+ years extended stay",
    "라이프스타일 선호": "Lifestyle preferences",
    "해당 항목 모두 선택": "Select all that apply",
    "사용 가능 언어": "Languages you speak",
    "가능한 언어 모두 선택": "Select all applicable",
    "관심 대륙 선택": "Preferred continents",
    "선택한 대륙의 도시가 추천에 우선 반영됩니다. 선택하지 않으면 전체 대상으로 추천합니다.":
        "Selected continents get priority. Leave blank for worldwide recommendations.",

    # Stay purposes
    "💻 원격 근무 / 프리랜서 활동": "💻 Remote work / Freelancing",
    "🌿 삶의 질 향상 (기후·생활비·환경)": "🌿 Better quality of life (climate/cost/environment)",
    "🗺️ 현재 노마드 — 다음 베이스 탐색": "🗺️ Currently nomadic — finding next base",
    "🏖️ 은퇴 후 장기 거주": "🏖️ Long-term retirement living",
    "💼 창업 / 사업 거점 이전": "💼 Starting business / relocating HQ",

    # Lifestyle options
    "🏖️ 해변": "🏖️ Beach",
    "🏙️ 도심": "🏙️ Urban",
    "💰 저물가": "💰 Low cost",
    "🔒 안전 우선": "🔒 Safety first",
    "🌐 영어권": "🌐 English-speaking",
    "☀️ 따뜻한 기후": "☀️ Warm climate",
    "❄️ 선선한 기후": "❄️ Cool climate",
    "🤝 노마드 커뮤니티": "🤝 Nomad community",
    "🍜 한국 음식": "🍜 Korean food",

    # Language options
    "영어 불가 / 한국어만": "No English / Korean only",
    "영어 기본 소통 가능": "Basic English",
    "영어 업무 수준": "Professional English",

    # Continents
    "아시아": "Asia",
    "유럽": "Europe",
    "중남미": "Latin America",

    # Accordion / diagnostic
    "🔍 내 노마드 유형 진단 (선택사항)": "🔍 Diagnose my nomad type (optional)",
    "질문으로 AI가 당신의 노마드 스타일을 파악합니다.":
        "Questions help AI understand your nomad style.",
    "생활비 절감 / FIRE": "Cost of living arbitrage / FIRE",
    "번아웃 회복 / 환경 전환": "Burnout recovery / change of scenery",
    "유럽 장기 체류 (쉥겐 루프)": "Extended Europe stay (Schengen route)",
    "한국 생활 리셋": "Reset Korean lifestyle",
    "사업/프리랜서 거점 이전": "Business/freelance hub relocation",
    "Q1. 노마드 생활을 고려하는 주된 이유 (복수 선택, 선택사항)":
        "Q1. Main reasons for considering nomad life (select all, optional)",
    "예 (유럽 루트 계획 있음)": "Yes (planning European route)",
    "아니오": "No",
    "Q2. 유럽에서 활동할 계획이 있나요?": "Q2. Do you plan to stay in Europe?",
    "비자·체류일 관리": "Visa & stay management",
    "생활비 예산": "Cost of living budget",
    "세금·법적 문제": "Tax & legal issues",
    "건강보험 공백": "Health insurance gaps",
    "외로움·커뮤니티": "Loneliness / community",
    "숙소 구하기": "Finding accommodation",
    "걱정되는 항목을 모두 선택하세요": "Select all concerns that apply",

    # Buttons
    "🚀 도시 추천 받기": "🚀 Get City Recommendations",
    "📖 상세 가이드 받기 →": "📖 Get Detailed Guide →",
    "📖 상세 가이드 받기": "📖 Get Detailed Guide",

    # Warnings / notices
    "⚠️ 본 서비스는 참고용이며 법적 비자/체류 조언이 아닙니다.":
        "⚠️ This service is for reference only and is not legal visa/stay advice.",

    # Step 2
    "1순위 도시": "1st choice city",
    "2순위 도시": "2nd choice city",
    "3순위 도시": "3rd choice city",
    "상세 가이드를 받을 도시 선택": "Select a city for detailed guide",

    # Placeholders / default text
    "← 왼쪽에서 프로필을 입력하고 분석을 시작하세요.":
        "← Enter your profile on the left to start.",
    "← Step 1을 먼저 완료한 후 도시를 선택하세요.":
        "← Complete Step 1 first, then select a city.",

    # Loading messages
    "앱을 불러오는 중이에요...": "Loading app...",

    # Globe map modal
    "🗺️ 나의 노마드 방명록": "🗺️ My Nomad Guestbook",
    "방문한 도시를 검색해서 핀을 남겨보세요": "Search visited cities and leave pins",
    "로그인하고 나만의 디지털 노마드 지도를 완성해보세요!":
        "Log in to complete your digital nomad map!",
    "Google로 로그인": "Login with Google",
    "로그아웃": "Logout",
    "커뮤니티 핀": "Community pins",
    "나의 핀": "My pins",
    "📍 위치 확인 중...": "📍 Checking location...",
    "📍 핀 추가": "📍 Add Pin",
    "도시명": "City name",
    "한줄평": "One-liner review",
    "예: 코워킹 천국, 한달살기 최고 🙌": "e.g., Coworking paradise, best for month-long stays 🙌",
    "위치 확인 중...": "Checking location...",
    "취소": "Cancel",
    "✓ 핀 저장하기": "✓ Save Pin",
    "닫기": "Close",
    "핀을 저장하고": "Save your pins and",
    "내 디지털노마드 지도를 완성해보세요!": "complete your digital nomad map!",
    "방문한 도시의 핀을 저장하고": "Save pins for visited cities",
    "나만의 노마드 여정을 기록해보세요": "and record your nomad journey",
    "님의 지도": "'s map",
    "환영합니다": "Welcome",

    # Login popup for step2
    "상세 가이드를 받으려면": "To get a detailed guide",
    "로그인이 필요합니다": "login is required",
    "AI가 분석한 맞춤형 상세 가이드를": "Get an AI-analyzed personalized guide",
    "로그인 후 무료로 받아보세요": "free after login",

    # Map strings
    "클릭하면 노마드 방명록 지도가 열려요 🗺️": "Click to open nomad guestbook map 🗺️",
    "프로필": "Profile",

    # Location
    "위치 미지원": "Location not supported",
    "📍 위치 확인됨": "📍 Location confirmed",
    "📍 위치 권한 필요": "📍 Location permission needed",
    "📍 위치 권한을 허용하면 확인할 수 있어요": "📍 Enable location permission to check",
    "핀이 저장됐어요.": "Pin saved.",
    "저장 중 오류가 발생했어요": "Error saving pin",

    # Search placeholder
    "도시 검색... 쿠알라룸푸르, Tbilisi, Budapest 등 어떤 언어도 OK":
        "Search cities... Kuala Lumpur, Tbilisi, Budapest — any language OK",

    # Loading messages
    "🔍 프로필을 분석하는 중이에요...": "🔍 Analyzing your profile...",
    "🌍 전 세계 비자 데이터를 검색하는 중이에요...": "🌍 Searching global visa data...",
    "🤖 AI가 최적의 도시를 선별하는 중이에요...": "🤖 AI selecting optimal cities...",
    "✨ 거의 다 됐어요!": "✨ Almost done!",
    "🏙️ 선택한 도시 정보를 불러오는 중이에요...": "🏙️ Loading selected city info...",
    "📋 맞춤 가이드를 작성하는 중이에요...": "📋 Creating personalized guide...",

    # Error messages
    "⚠️ 오류가 발생했습니다:": "⚠️ An error occurred:",

    # Map popup text
    "노마드": "Nomads",
    "명": " people",
    "에 핀 추가": "Add pin to",
    "✅ 현재 위치 근처 (약": "✅ Near current location (approx.",
    "⚠️ 현재 위치와": "⚠️ Current location and",
    "km 떨어져 있어요": "km away",

    # 로그인 text
    "로그인": "Login",
}

# Local cities: Korean name → English name
LOCAL_CITIES_EN = {
    "서울": "Seoul", "부산": "Busan",
    "방콕": "Bangkok", "치앙마이": "Chiang Mai",
    "발리": "Bali", "자카르타": "Jakarta",
    "쿠알라룸푸르": "Kuala Lumpur",
    "리스본": "Lisbon", "바르셀로나": "Barcelona", "마드리드": "Madrid",
    "메데진": "Medellín", "도쿄": "Tokyo", "오사카": "Osaka",
    "싱가포르": "Singapore", "프라하": "Prague",
    "트빌리시": "Tbilisi", "부다페스트": "Budapest",
    "암스테르담": "Amsterdam", "베를린": "Berlin",
    "멕시코시티": "Mexico City", "부에노스아이레스": "Buenos Aires",
    "호치민": "Ho Chi Minh City", "하노이": "Hanoi",
    "두바이": "Dubai", "이스탄불": "Istanbul",
    "대한민국": "South Korea", "태국": "Thailand",
    "인도네시아": "Indonesia", "말레이시아": "Malaysia",
    "포르투갈": "Portugal", "스페인": "Spain",
    "콜롬비아": "Colombia", "일본": "Japan",
    "체코": "Czech Republic", "조지아": "Georgia",
    "헝가리": "Hungary", "네덜란드": "Netherlands",
    "독일": "Germany", "멕시코": "Mexico",
    "아르헨티나": "Argentina", "베트남": "Vietnam",
    "UAE": "UAE", "튀르키예": "Turkey",
}


def build_i18n_js() -> str:
    """Build JS that auto-detects browser language and replaces Korean text."""
    import json
    map_json = json.dumps(I18N_MAP, ensure_ascii=False)
    cities_json = json.dumps(LOCAL_CITIES_EN, ensure_ascii=False)

    return f"""
(function(){{
'use strict';
var _i18n = {map_json};
var _citiesEn = {cities_json};
var _isKo = /^ko/i.test(navigator.language || navigator.userLanguage || 'en');

if(_isKo) return; // Korean users: no changes needed

/* ── Replace text nodes ── */
function replaceTextInNode(node) {{
  if(node.nodeType === 3) {{ // text node
    var t = node.textContent;
    for(var ko in _i18n) {{
      if(t.indexOf(ko) !== -1) {{
        t = t.split(ko).join(_i18n[ko]);
      }}
    }}
    node.textContent = t;
    return;
  }}
  // For elements with placeholder attribute
  if(node.placeholder) {{
    for(var ko2 in _i18n) {{
      if(node.placeholder.indexOf(ko2) !== -1) {{
        node.placeholder = node.placeholder.split(ko2).join(_i18n[ko2]);
      }}
    }}
  }}
  // For elements with title attribute
  if(node.title) {{
    for(var ko3 in _i18n) {{
      if(node.title.indexOf(ko3) !== -1) {{
        node.title = node.title.split(ko3).join(_i18n[ko3]);
      }}
    }}
  }}
  for(var i = 0; i < node.childNodes.length; i++) {{
    replaceTextInNode(node.childNodes[i]);
  }}
}}

/* ── Auto-select English in language radio ── */
function autoSelectEnglish() {{
  var container = document.getElementById('nnai-ui-language');
  if(!container) return;
  var radios = container.querySelectorAll('input[type=radio]');
  radios.forEach(function(r) {{
    var label = r.closest('label') || r.parentElement;
    if(label && label.textContent.trim() === 'English') {{
      r.click();
      r.dispatchEvent(new Event('input', {{bubbles:true}}));
      r.dispatchEvent(new Event('change', {{bubbles:true}}));
    }}
  }});
}}

/* ── Replace LOCAL_CITIES names ── */
function replaceCityNames() {{
  var scripts = document.querySelectorAll('script');
  // City names in map markers are rendered via JS, handled by observer
}}

/* ── Main i18n apply ── */
function applyI18n() {{
  replaceTextInNode(document.body);
  autoSelectEnglish();
}}

/* ── Run on load + observe for Gradio dynamic updates ── */
var _i18nTimer = setInterval(function() {{
  if(document.querySelector('.gradio-container')) {{
    clearInterval(_i18nTimer);
    setTimeout(applyI18n, 300);

    // Re-apply on Gradio dynamic updates
    var observer = new MutationObserver(function(mutations) {{
      mutations.forEach(function(m) {{
        m.addedNodes.forEach(function(node) {{
          if(node.nodeType === 1) replaceTextInNode(node);
        }});
      }});
    }});
    observer.observe(document.body, {{ childList: true, subtree: true }});
  }}
}}, 100);
}})();
"""
