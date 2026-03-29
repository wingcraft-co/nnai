# ui/layout.py
import json
import os
import gradio as gr
from ui.theme import create_theme
from ui.loading import get_loading_html, get_cycling_loading_html, LOADING_CLEAR, HEADER_GLOBE_HTML, HEADER_GLOBE_JS
from ui.globe_map import build_globe_map_html
from ui.i18n import build_i18n_js

# 모듈 레벨 환율 캐싱 (앱 기동 시 1회 조회 — 이후 재사용)
_EXCHANGE_RATE_USD: float | None = None


def _resolve_ui_language(request: gr.Request | None = None, explicit: str | None = None) -> str:
    """Resolve UI language from explicit value first, then request headers."""
    if explicit in ("한국어", "English"):
        return explicit
    if request is None:
        return "한국어"
    accept_language = (request.headers.get("accept-language") or "").lower()
    return "한국어" if accept_language.startswith("ko") else "English"


def _get_exchange_rate_usd() -> float:
    """USD/KRW 환율을 캐싱하여 반환. 실패 시 기본값(0.000714 ≈ 1,400원/달러) 사용."""
    global _EXCHANGE_RATE_USD
    if _EXCHANGE_RATE_USD is None:
        try:
            import utils.currency
            rates = utils.currency.get_exchange_rates()
            _EXCHANGE_RATE_USD = rates.get("USD", 0.000714)
        except Exception:
            _EXCHANGE_RATE_USD = 0.000714
    return _EXCHANGE_RATE_USD


def check_income_warning(
    income_krw: float,
    preferred_countries: list,
    travel_type: str,
    timeline: str,
    exchange_rate_usd: float | str | None = None,
    ui_language: str | None = None,
    request: gr.Request | None = None,
) -> tuple:
    """
    입력값 조합을 평가하여 경고 문구 반환. LLM 호출 없음.

    Args:
        income_krw: 월 소득 (만원 단위)
        preferred_countries: 선택된 대륙 목록 (예: ["유럽", "아시아"])
        travel_type: 동반 여부 문자열
        timeline: 목표 체류 기간 문자열
        exchange_rate_usd: USD 환율. None이면 캐싱값 사용.

    Returns:
        tuple: (income_warning_update, submit_warning_update, btn_interactive_update)
    """
    # Backward compatibility:
    # - old callers: arg5=exchange_rate_usd (float)
    # - new UI wiring: arg5=ui_language ("한국어"/"English")
    if isinstance(exchange_rate_usd, str):
        ui_language = exchange_rate_usd
        exchange_rate_usd = None

    ui_language = _resolve_ui_language(request=request, explicit=ui_language)
    usd_rate = exchange_rate_usd if exchange_rate_usd is not None else _get_exchange_rate_usd()
    income_usd = (income_krw or 0) * 10000 * usd_rate

    income_warnings: list[str] = []
    submit_warnings: list[str] = []
    hard_block = False
    is_en = ui_language == "English"

    # Case 1: 유럽 소득 기준
    if "유럽" in (preferred_countries or []):
        if income_usd < 1000 and timeline in ["3년 장기 체류", "5년 이상 초장기 체류"]:
            hard_block = True
            submit_warnings.append(
                "🚫 No eligible cities with current conditions. Increase income, or adjust target duration/continent."
                if is_en else
                "🚫 현재 조건으로는 추천 가능한 도시가 없어요. "
                "소득을 높이거나 체류 기간 또는 대륙을 변경해주세요."
            )
        elif income_usd < 1500:
            income_warnings.append(
                "⚠️ Your current income may be too low for long-stay Europe visas. "
                "Try Asia/Latin America or cities with lower income thresholds."
                if is_en else
                "⚠️ 현재 소득으로는 유럽 장기 비자 신청이 어려울 수 있어요. "
                "아시아·중남미로 대륙을 변경하거나 소득 기준이 낮은 도시를 추천받아보세요."
            )
        elif income_usd < 2849:
            income_warnings.append(
                "⚠️ You may fall below common Europe visa income thresholds ($2,849-$3,680/month). "
                "Recommendations may be limited."
                if is_en else
                "⚠️ 유럽 비자 최소 소득 기준($2,849~$3,680/월)에 미달할 수 있어요. "
                "추천 결과가 제한될 수 있어요."
            )

    # Case 1: 중남미 소득 기준
    if "중남미" in (preferred_countries or []) and income_usd < 1000:
        income_warnings.append(
            "⚠️ You may fall below visa income thresholds in some Latin American countries ($1,000-$3,000/month)."
            if is_en else
            "⚠️ 중남미 일부 국가의 비자 소득 기준($1,000~$3,000/월)에 미달할 수 있어요."
        )

    # Case 2: 가족 전체 동반 소득
    if "가족 전체 동반" in (travel_type or "") and income_usd < 3000:
        income_warnings.append(
            "⚠️ With family + current income, long-stay visa options are limited. "
            "Recommendations will skew toward Asia."
            if is_en else
            "⚠️ 가족 동반 + 현재 소득 조건으로는 추천 가능한 장기 비자가 제한돼요. "
            "아시아 지역을 중심으로 추천이 진행됩니다."
        )

    # Case 3: 90일 이하
    if timeline == "90일 이하 (비자 없이 탐색)":
        income_warnings.append(
            "ℹ️ For stays under 90 days, recommendations focus on visa-free destinations."
            if is_en else
            "ℹ️ 90일 이하 체류는 무비자 국가를 중심으로 추천돼요. "
            "비자 신청 없이 입국 가능한 도시를 안내해드려요."
        )

    return (
        gr.update(
            visible=bool(income_warnings),
            value="\n\n".join(income_warnings) if income_warnings else "",
        ),
        gr.update(
            visible=bool(submit_warnings),
            value="\n\n".join(submit_warnings) if submit_warnings else "",
        ),
        gr.update(interactive=not hard_block),
    )


def check_companion_warning(
    travel_type: str,
    has_spouse_income: str,
    ui_language: str | None = None,
    request: gr.Request | None = None,
) -> dict:
    """
    배우자/가족 동반 시 소득 미입력 경고.

    Returns:
        gr.update dict (visible, value)
    """
    ui_language = _resolve_ui_language(request=request, explicit=ui_language)

    if travel_type in ["배우자·파트너 동반", "가족 전체 동반 (배우자 + 자녀)"]:
        if has_spouse_income != "있음":
            return gr.update(
                visible=True,
                value=(
                    "ℹ️ Some countries allow combined household income for spouse/family visas. "
                    "Adding spouse income improves recommendation accuracy."
                    if ui_language == "English" else
                    "ℹ️ 배우자 동반 시 일부 국가는 합산 소득 기준을 적용해요. "
                    "배우자 소득을 입력하면 더 정확한 추천이 가능해요."
                ),
            )
    return gr.update(visible=False, value="")


def _country_code_to_flag(code: str) -> str:
    """Convert 2-letter ISO country code to flag emoji via Unicode regional indicators."""
    code = code.upper()
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in code)


ISO2_TO_ISO3 = {
    "MY": "MYS", "PT": "PRT", "TH": "THA", "EE": "EST",
    "ES": "ESP", "ID": "IDN", "DE": "DEU", "GE": "GEO",
    "CR": "CRI", "GR": "GRC", "PH": "PHL", "VN": "VNM",
}


def _city_btn_label(city_data: dict, prefer_english: bool = False) -> str:
    code = city_data.get("country_id", "")
    flag = _country_code_to_flag(code) if code else ""
    city = city_data.get("city", "?") if prefer_english else (city_data.get("city_kr") or city_data.get("city", "?"))
    return f"{flag} {city}".strip()

NATIONALITIES = [
    "Korean", "Japanese", "Chinese", "American",
    "British", "German", "French", "Australian", "Other",
]

STAY_PURPOSES = [
    "💻 원격 근무 / 프리랜서 활동",
    "🌿 삶의 질 향상 (기후·생활비·환경)",
    "🗺️ 현재 노마드 — 다음 베이스 탐색",
    "🏖️ 은퇴 후 장기 거주",
    "💼 창업 / 사업 거점 이전",
]

LIFESTYLE_OPTIONS = [
    "🏖️ 해변",
    "🏙️ 도심",
    "💰 저물가",
    "🔒 안전 우선",
    "🌐 영어권",
    "☀️ 따뜻한 기후",
    "❄️ 선선한 기후",
    "🤝 노마드 커뮤니티",
    "🍜 한국 음식",
]

LANGUAGE_OPTIONS = [
    "영어 불가 / 한국어만",
    "영어 기본 소통 가능",
    "영어 업무 수준",
]

CONTINENT_OPTIONS = [
    "아시아",    # TH, MY, ID, PH, VN, JP, GE
    "유럽",      # PT, EE, ES, DE, GR, HR, CZ, HU, SI, MT, RS, AL, MK
    "중남미",    # CR, MX, CO, AR, BR
    # "북미",          # DB 미보유 — city_scores.json에 해당 도시 없음
    # "중동/아프리카",  # DB 미보유 — city_scores.json에 해당 도시 없음
]

LANGUAGE_TOGGLE_OPTIONS = ["한국어", "English"]

# Step 1 로딩 메시지 시퀀스
_STEP1_LOADING = [
    "🔍 프로필을 분석하는 중이에요...",
    "🌍 전 세계 비자 데이터를 검색하는 중이에요...",
    "🤖 AI가 최적의 도시를 선별하는 중이에요...",
    "✨ 거의 다 됐어요!",
]

_STEP1_LOADING_EN = [
    "🔍 Analyzing your profile...",
    "🌍 Scanning global visa data...",
    "🤖 AI is selecting the best-fit cities...",
    "✨ Almost done...",
]

# Step 2 로딩 메시지 시퀀스
_STEP2_LOADING = [
    "🏙️ 선택한 도시 정보를 불러오는 중이에요...",
    "📋 맞춤 가이드를 작성하는 중이에요...",
]

_STEP2_LOADING_EN = [
    "🏙️ Loading selected city details...",
    "📋 Building your personalized guide...",
]


_APP_CSS = """
:root{--nn-title:#0C447C;--nn-sub:#888780}
.dark{--nn-title:#60A5FA;--nn-sub:#9CA3AF}
@media(prefers-color-scheme:dark){:root:not(.light){--nn-title:#60A5FA;--nn-sub:#9CA3AF}}
.main-header{text-align:center;padding:20px 0 10px}
.main-header h1{font-size:2rem;color:var(--nn-title)}
.main-header p{color:var(--nn-sub);font-size:.95rem}
footer{display:none!important}
.ad-sidebar{width:300px;min-height:600px;padding:8px;background-color:#f9f9f9;border-left:1px solid #e0e0e0;border-radius:4px;box-sizing:border-box;}
@media(max-width:1023px){.ad-sidebar{display:none!important}}
@media(min-width:1024px){.ad-sidebar{display:block!important}}
"""


def _create_ad_sidebar_html():
    """Generate Google AdSense sidebar HTML. Returns placeholder div if config missing/disabled."""
    ads_config_path = os.path.join(os.path.dirname(__file__), '../data/ads_config.json')

    if not os.path.exists(ads_config_path):
        return '<div class="ad-sidebar"></div>'

    try:
        with open(ads_config_path, 'r') as f:
            ads_config = json.load(f)
    except (json.JSONDecodeError, OSError):
        return '<div class="ad-sidebar"></div>'

    if not ads_config.get('enabled', False):
        return '<div class="ad-sidebar"></div>'

    publisher_id = ads_config.get('google_adsense', {}).get('publisher_id', '')
    ad_slot = ads_config.get('google_adsense', {}).get('ad_slot_vertical', '')

    if not publisher_id or not ad_slot or 'xxxxxxxx' in publisher_id:
        return '<div class="ad-sidebar"><p style="color:#aaa;font-size:12px;text-align:center;padding-top:20px;">광고 영역</p></div>'

    return f"""<div class="ad-sidebar">
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={publisher_id}"
            crossorigin="anonymous"></script>
        <ins class="adsbygoogle"
            style="display:block"
            data-ad-client="{publisher_id}"
            data-ad-slot="{ad_slot}"
            data-ad-format="auto"
            data-full-width-responsive="true"></ins>
        <script>
            (adsbygoogle = window.adsbygoogle || []).push({{}});
        </script>
    </div>"""


def create_layout(advisor_fn, detail_fn):
    with gr.Blocks(title="NomadNavigator AI", css=_APP_CSS) as demo:

        # ── 로딩 오버레이 (position:fixed — DOM 위치 무관) ───────────────
        # 초기값: 앱 로딩 중 지구본 애니메이션 표시 → demo.load() 시 클리어
        loading_overlay = gr.HTML(
            value=get_loading_html("앱을 불러오는 중이에요..."),
            elem_id="nnai-loading-overlay",
        )

        # ── 세계지도 모달 (position:fixed — DOM 위치 무관) ──────────────
        globe_html = build_globe_map_html()
        gr.HTML(value=globe_html, elem_id="nnai-globe-map-modal")

        # 글로벌 함수 초기화 (layout.py의 js_on_load로 실행)
        init_script = """
(function(){
'use strict';
var _sysKo = /^ko/i.test(navigator.language || navigator.userLanguage || 'en');

/* ── Leaflet 동적 로드 ── */
function loadLeaflet(){
  if(typeof L !== 'undefined') { setupNomadMap(); return; }

  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);

  var script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.onload = function(){ console.log('✓ Leaflet loaded'); setupNomadMap(); };
  script.onerror = function(){ console.error('Failed to load Leaflet'); };
  document.head.appendChild(script);
}

/* ── 상수 ── */
var LOCAL_CITIES=[
  {name:'서울',country:'대한민국',flag:'🇰🇷',lat:37.5665,lng:126.978},
  {name:'부산',country:'대한민국',flag:'🇰🇷',lat:35.1796,lng:129.0756},
  {name:'방콕',country:'태국',flag:'🇹🇭',lat:13.7563,lng:100.5018},
  {name:'치앙마이',country:'태국',flag:'🇹🇭',lat:18.7883,lng:98.9853},
  {name:'발리',country:'인도네시아',flag:'🇮🇩',lat:-8.3405,lng:115.092},
  {name:'자카르타',country:'인도네시아',flag:'🇮🇩',lat:-6.2088,lng:106.8456},
  {name:'쿠알라룸푸르',country:'말레이시아',flag:'🇲🇾',lat:3.139,lng:101.6869},
  {name:'리스본',country:'포르투갈',flag:'🇵🇹',lat:38.7169,lng:-9.1395},
  {name:'바르셀로나',country:'스페인',flag:'🇪🇸',lat:41.3851,lng:2.1734},
  {name:'마드리드',country:'스페인',flag:'🇪🇸',lat:40.4168,lng:-3.7038},
  {name:'메데진',country:'콜롬비아',flag:'🇨🇴',lat:6.2442,lng:-75.5812},
  {name:'도쿄',country:'일본',flag:'🇯🇵',lat:35.6762,lng:139.6503},
  {name:'오사카',country:'일본',flag:'🇯🇵',lat:34.6937,lng:135.5023},
  {name:'싱가포르',country:'싱가포르',flag:'🇸🇬',lat:1.3521,lng:103.8198},
  {name:'프라하',country:'체코',flag:'🇨🇿',lat:50.0755,lng:14.4378},
  {name:'트빌리시',country:'조지아',flag:'🇬🇪',lat:41.6938,lng:44.8015},
  {name:'부다페스트',country:'헝가리',flag:'🇭🇺',lat:47.4979,lng:19.0402},
  {name:'암스테르담',country:'네덜란드',flag:'🇳🇱',lat:52.3676,lng:4.9041},
  {name:'베를린',country:'독일',flag:'🇩🇪',lat:52.52,lng:13.405},
  {name:'멕시코시티',country:'멕시코',flag:'🇲🇽',lat:19.4326,lng:-99.1332},
  {name:'부에노스아이레스',country:'아르헨티나',flag:'🇦🇷',lat:-34.6037,lng:-58.3816},
  {name:'호치민',country:'베트남',flag:'🇻🇳',lat:10.8231,lng:106.6297},
  {name:'하노이',country:'베트남',flag:'🇻🇳',lat:21.0285,lng:105.8542},
  {name:'두바이',country:'UAE',flag:'🇦🇪',lat:25.2048,lng:55.2708},
  {name:'이스탄불',country:'튀르키예',flag:'🇹🇷',lat:41.0082,lng:28.9784},
];

/* ── 상태 ── */
var _map=null, _journeyLine=null, _myLatLngs=[], _myCount=0;
var _selCity=null, _acResults=[], _acHi=-1, _debounce=null;
var _userLat=null, _userLng=null, _userId=null;

/* ── DOM refs ── */
var $ = function(id){return document.getElementById(id);};

/* ── 지도 초기화 ── */
function initMap(){
  if(_map) return;
  _map = L.map('nnai-leaflet-map',{
    center:[20,10],zoom:2,minZoom:2,maxZoom:8,
    worldCopyJump:true,attributionControl:false
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(_map);
  _map.on('click', function(){});
}

function mkIcon(cls,size){
  size=size||13;
  return L.divIcon({className:'',
    html:'<div class="'+cls+'" style="width:'+size+'px;height:'+size+'px;border-radius:50%;"></div>',
    iconSize:[size,size],iconAnchor:[size/2,size/2]});
}

/* ── 커뮤니티 핀 로드 ── */
function loadCommunityPins(){
  fetch('/api/pins/community').then(function(r){return r.json();}).then(function(pins){
    $('nnai-com-count').textContent=pins.length;
    pins.forEach(function(p){
      var style='width:11px;height:11px;border-radius:50%;background:#4FC3F7;border:2px solid rgba(255,255,255,.7);box-shadow:0 0 7px rgba(79,195,247,.7);';
      var icon=L.divIcon({className:'',html:'<div style="'+style+'"></div>',iconSize:[11,11],iconAnchor:[5,5]});
      L.marker([p.lat,p.lng],{icon:icon}).addTo(_map)
       .bindPopup('<b style="color:#4FC3F7">'+p.city+'</b><br><small style="color:rgba(255,255,255,.6)">노마드 '+p.cnt+'명</small>');
    });
  }).catch(function(){$('nnai-com-count').textContent='?';});
}

/* ── 내 핀 로드 ── */
function loadMyPins(){
  fetch('/api/pins').then(function(r){return r.json();}).then(function(pins){
    _myLatLngs=[];
    pins.forEach(function(p){addMyPinToMap(p,false);});
    redrawJourney();
    $('nnai-my-count').textContent=_myCount;
  });
}

function addMyPinToMap(p, animate){
  var style='width:14px;height:14px;border-radius:50%;background:#FF8C00;border:2px solid #fff;box-shadow:0 0 12px rgba(255,140,0,.9);';
  if(animate) style+='animation:nnaiPinPop .5s cubic-bezier(.34,1.56,.64,1) forwards;';
  var icon=L.divIcon({className:'',html:'<div style="'+style+'"></div>',iconSize:[14,14],iconAnchor:[7,7]});
  L.marker([p.lat,p.lng],{icon:icon}).addTo(_map)
   .bindPopup('<b style="color:#FF8C00">📍 '+p.city+'</b><br><small style="color:rgba(255,255,255,.7)">'+(p.note||'')+'</small>');
  _myLatLngs.push([p.lat,p.lng]);
  _myCount++;
}

function redrawJourney(){
  if(_journeyLine){_map.removeLayer(_journeyLine);_journeyLine=null;}
  if(_myLatLngs.length>1){
    _journeyLine=L.polyline(_myLatLngs,{color:'#FF8C00',weight:2.5,opacity:.8}).addTo(_map);
  }
}

/* ── 위치 권한 ── */
function checkLocation(){
  if(!navigator.geolocation) return setLocStatus(false,'위치 미지원');
  navigator.geolocation.getCurrentPosition(function(pos){
    _userLat=pos.coords.latitude; _userLng=pos.coords.longitude;
    setLocStatus(true,'📍 위치 확인됨');
  },function(){setLocStatus(false,'📍 위치 권한 필요');});
}
function setLocStatus(ok,txt){
  var el=$('nnai-loc-status');
  el.textContent=txt;
  el.className=ok?'nnai-loc-ok':'nnai-loc-off';
}

/* ── 인증 상태 확인 ── */
var _isLoggedIn = false;
function checkAuth(){
  fetch('/auth/me').then(function(r){return r.json();}).then(function(d){
    var cta=$('nnai-login-cta'), bar=$('nnai-user-bar');
    if(d.logged_in){
      _isLoggedIn = true;
      _userId=d.uid;
      if(cta) cta.style.display='none';
      if(bar) bar.style.display='flex';
      var nameEl=$('nnai-user-name');
      if(nameEl) nameEl.textContent=_sysKo ? (d.name+' 님의 지도') : (d.name+"'s map");
      var pic=$('nnai-user-pic');
      if(pic && d.picture) pic.src=d.picture;
      loadMyPins();
    } else {
      _isLoggedIn = false;
      if(cta) cta.style.display='flex';
      if(bar) bar.style.display='none';
    }
  });
}

/* ── STEP2 로그인 유도 팝업 ── */
function showLoginPopupForStep2(){
  var t1=$('nnai-login-popup-title1');
  var t2=$('nnai-login-popup-title2');
  var desc=$('nnai-login-popup-desc');
  if(t1) t1.textContent=_sysKo ? '상세 가이드를 받으려면' : 'To get a detailed guide';
  if(t2) t2.textContent=_sysKo ? '로그인이 필요합니다' : 'Login is required';
  if(desc) desc.innerHTML=_sysKo
    ? 'AI가 분석한 맞춤형 상세 가이드를<br/>로그인 후 무료로 받아보세요'
    : 'Get an AI-personalized detailed guide<br/>free after login';
  var bg=$('nnai-login-popup-bg');
  if(bg) bg.style.display='flex';
}

function requireLoginForStep2(){
  if(_isLoggedIn) return true;
  showLoginPopupForStep2();
  return false;
}

/* ── STEP2 버튼 로그인 가드 ── */
(function(){
  function guardBtn(id){
    var el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('click',function(e){
      if(!_isLoggedIn){
        e.stopImmediatePropagation();
        e.preventDefault();
        showLoginPopupForStep2();
      }
    },true);
  }
  var _guard=setInterval(function(){
    if(document.getElementById('btn-go-step2')||document.getElementById('btn-step2')){
      guardBtn('btn-go-step2');
      guardBtn('btn-step2');
      clearInterval(_guard);
    }
  },500);
})();

/* ── 도시 검색 ── */
function fuzzyMatch(str,q){
  str=str.toLowerCase(); q=q.toLowerCase();
  for(var qi=0,si=0;qi<q.length;qi++){
    si=str.indexOf(q[qi],si);
    if(si<0) return false;
    si++;
  }
  return true;
}

function onSearchInput(){
  var val=$('nnai-search-input').value.trim();
  clearTimeout(_debounce);
  if(!val){closeAc();setSearchStatus('');return;}
  var local=LOCAL_CITIES.filter(function(c){return fuzzyMatch(c.name,val)||fuzzyMatch(c.country,val);});
  _acResults=local.slice();
  if(_acResults.length) renderAc();
  setSearchStatus('<div class="nnai-ac-spin"></div>');
  _debounce=setTimeout(function(){nominatimSearch(val);},400);
}

function nominatimSearch(q){
  var langHeader = _sysKo ? 'ko,en' : 'en';
  var url='https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(q)
    +'&format=json&limit=6&accept-language='+encodeURIComponent(langHeader)+'&addressdetails=1';
  fetch(url,{headers:{'Accept-Language':langHeader}})
    .then(function(r){return r.json();})
    .then(function(data){
      setSearchStatus('');
      if(!data.length) return;
      var seen=_acResults.map(function(r){return Math.round(r.lat*10)+','+Math.round(r.lng*10);});
      data.forEach(function(d){
        var addr=d.address||{};
        var city=addr.city||addr.town||addr.municipality||addr.county||d.display_name.split(',')[0];
        var country=addr.country||'';
        var cc=(addr.country_code||'').toUpperCase();
        var flag=[...cc].map(function(c){return String.fromCodePoint(0x1F1E6-65+c.charCodeAt(0));}).join('');
        var lat=parseFloat(d.lat), lng=parseFloat(d.lon);
        var key=Math.round(lat*10)+','+Math.round(lng*10);
        if(!seen.includes(key)&&lat&&lng){
          seen.push(key);
          _acResults.push({name:city,country:country,flag:flag||'🌍',lat:lat,lng:lng,
            display:d.display_name.split(',').slice(0,2).join(',').trim()});
        }
      });
      _acResults=_acResults.slice(0,7);
      renderAc();
    }).catch(function(){setSearchStatus('');});
}

function renderAc(){
  var ac=$('nnai-ac');
  _acHi=-1;
  ac.innerHTML=_acResults.map(function(c,i){
    return '<div class="nnai-ac-item" data-i="'+i+'">'
      +'<span class="nnai-ac-flag">'+c.flag+'</span>'
      +'<div><div class="nnai-ac-name">'+c.name+'</div>'
      +'<div class="nnai-ac-sub">'+(c.display&&c.display!==c.name?c.display+' · ':'')
      +'<span style="color:rgba(255,255,255,.28)">'+c.lat.toFixed(2)+', '+c.lng.toFixed(2)+'</span></div></div>'
      +'</div>';
  }).join('');
  ac.querySelectorAll('.nnai-ac-item').forEach(function(el){
    el.addEventListener('mousedown',function(){selectCity(parseInt(el.dataset.i));});
    el.addEventListener('mouseover',function(){hiAc(parseInt(el.dataset.i));});
  });
  ac.classList.add('open');
}
function closeAc(){$('nnai-ac').classList.remove('open');}
function hiAc(i){
  _acHi=i;
  $('nnai-ac').querySelectorAll('.nnai-ac-item').forEach(function(el,j){
    el.classList.toggle('hi',j===i);
  });
}
function setSearchStatus(html){$('nnai-search-status').innerHTML=html;}

/* ── 도시 선택 ── */
function selectCity(i){
  var c=_acResults[i]; if(!c) return;
  _selCity=c;
  $('nnai-search-input').value=c.name; closeAc(); setSearchStatus('');
  _map.flyTo([c.lat,c.lng],6,{duration:1.3});
  setTimeout(openPinPopup,800);
}

/* ── 핀 팝업 ── */
function openPinPopup(){
  var c=_selCity;
  $('nnai-pin-title').textContent='📍 '+c.name+'에 핀 추가';
  $('nnai-pin-sub').textContent=c.display||c.country||'';
  $('nnai-pp-city').value=(c.display||c.name+', '+c.country);
  $('nnai-pp-note').value='';
  $('nnai-pin-bg').classList.add('open');
  setTimeout(function(){$('nnai-pp-note').focus();},200);

  var locEl=$('nnai-pp-loc-text'), dotEl=$('nnai-pp-dot'), boxEl=$('nnai-pin-loc');
  function setLoc(ok,txt){
    locEl.textContent=txt;
    if(ok){boxEl.style.cssText='background:rgba(76,175,80,.08);border:1px solid rgba(76,175,80,.25);color:#81C784;border-radius:7px;padding:8px 11px;margin-top:12px;font-size:.73rem;display:flex;align-items:center;gap:6px;';dotEl.style.background='#4CAF50';}
    else{boxEl.style.cssText='background:rgba(255,100,0,.08);border:1px solid rgba(255,100,0,.2);color:#FF8A65;border-radius:7px;padding:8px 11px;margin-top:12px;font-size:.73rem;display:flex;align-items:center;gap:6px;';dotEl.style.background='#FF7043';dotEl.style.animation='none';}
  }
  if(_userLat!==null){
    var R=6371,dA=(c.lat-_userLat)*Math.PI/180,dB=(c.lng-_userLng)*Math.PI/180;
    var a=Math.pow(Math.sin(dA/2),2)+Math.cos(_userLat*Math.PI/180)*Math.cos(c.lat*Math.PI/180)*Math.pow(Math.sin(dB/2),2);
    var dist=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    dist<200?setLoc(true,'✅ 현재 위치 근처 (약 '+Math.round(dist)+'km)')
            :setLoc(false,'⚠️ 현재 위치와 '+Math.round(dist)+'km 떨어져 있어요');
  } else {
    setLoc(false,'📍 위치 권한을 허용하면 확인할 수 있어요');
  }
}
function closePinPopup(){$('nnai-pin-bg').classList.remove('open');}

/* ── 로그인 팝업 제어 ── */
function showLoginPopup(){
  $('nnai-login-popup-bg').style.display='flex';
}
function closeLoginPopup(){
  $('nnai-login-popup-bg').style.display='none';
}

/* ── 핀 저장 ── */
function savePin(){
  var c=_selCity; if(!c) return;
  if(!_userId){
    showLoginPopup();
    return;
  }
  var note=$('nnai-pp-note').value.trim();
  $('nnai-pin-save').disabled=true;
  fetch('/api/pins',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({city:c.name,display:c.display||c.name+', '+c.country,
      note:note,lat:c.lat,lng:c.lng,user_lat:_userLat,user_lng:_userLng})
  }).then(function(r){return r.json();}).then(function(data){
    closePinPopup();
    $('nnai-search-input').value='';
    addMyPinToMap({lat:c.lat,lng:c.lng,city:c.name,note:note},true);
    redrawJourney();
    $('nnai-my-count').textContent=_myCount;
    var rip=L.circle([c.lat,c.lng],{radius:150000,color:'#FF8C00',weight:1,fillColor:'#FF8C00',fillOpacity:.1}).addTo(_map);
    setTimeout(function(){_map.removeLayer(rip);},1200);
    showToast('📍 '+c.name+' 핀이 저장됐어요!');
  }).catch(function(){showToast('저장 중 오류가 발생했어요');})
  .finally(function(){$('nnai-pin-save').disabled=false;});
}

/* ── Toast ── */
function showToast(msg){
  var t=$('nnai-toast'); t.textContent=msg; t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},2800);
}

/* ── 모달 열기/닫기 ── */
window.nnaiOpenMap=function(){
  $('nnai-map-modal-bg').classList.add('open');
  if(!_map){initMap(); setTimeout(function(){_map.invalidateSize();checkAuth();checkLocation();loadCommunityPins();},200);}
  else{_map.invalidateSize();checkAuth();}
};
window.nnaiCloseMap=function(){$('nnai-map-modal-bg').classList.remove('open');};

/* ── 이벤트 셋업 ── */
function setupNomadMap(){
  var searchInput = $('nnai-search-input');
  if(!searchInput || searchInput.__nnaiSetup) return;
  searchInput.__nnaiSetup = true;

  console.log('Setting up Nomad Map');

  searchInput.addEventListener('input', onSearchInput);
  searchInput.addEventListener('keydown', function(e){
    var items = $('nnai-ac').querySelectorAll('.nnai-ac-item');
    if(e.key==='ArrowDown'){_acHi=Math.min(_acHi+1,items.length-1);hiAc(_acHi);e.preventDefault();}
    else if(e.key==='ArrowUp'){_acHi=Math.max(_acHi-1,0);hiAc(_acHi);e.preventDefault();}
    else if(e.key==='Enter'&&_acHi>=0){selectCity(_acHi);}
    else if(e.key==='Escape'){closeAc();}
  });
  searchInput.addEventListener('blur', function(){setTimeout(closeAc, 200);});

  $('nnai-pin-cancel').onclick = closePinPopup;
  $('nnai-pin-save').onclick = savePin;
  $('nnai-pp-note').addEventListener('keydown', function(e){if(e.key==='Enter')savePin();});
  $('nnai-login-popup-cancel').onclick = closeLoginPopup;
  $('nnai-login-popup-bg').addEventListener('click', function(e){if(e.target === this) closeLoginPopup();});

  console.log('✓ Nomad Map ready');
}

// Initialize
setTimeout(function(){
  loadLeaflet();
  checkAuth();
}, 100);
})();
        """
        gr.HTML(value="", js_on_load=init_script)

        # ── i18n (브라우저 언어 자동 감지) ─────────────────────────────
        gr.HTML(value="", js_on_load=build_i18n_js())

        with gr.Row():
            with gr.Column(scale=4):
                # ── 헤더 ──────────────────────────────────────────────────────
                # js_on_load=: 컴포넌트 마운트 시 Gradio가 직접 JS를 실행해줌
                with gr.Column(elem_classes="main-header"):
                    gr.HTML(
                        value=HEADER_GLOBE_HTML,
                        js_on_load=HEADER_GLOBE_JS,
                    )
                    gr.HTML('<p style="color:#888780;font-size:.95rem;margin:0;">국적 · 소득 · 체류 목적을 입력하면 AI가 최적의 장기 체류 도시를 제안합니다</p>')

                # ── State ──────────────────────────────────────────────────────
                parsed_state = gr.State({})

                # ── Tabs ───────────────────────────────────────────────────────
                with gr.Tabs() as tabs:

                    # ── Tab 1: 도시 추천 ───────────────────────────────────────
                    with gr.Tab("🔍 도시 추천", id=0):
                        with gr.Row():
                            # 입력 패널
                            with gr.Column(scale=1):
                                gr.Markdown("### 📋 내 프로필 입력")

                                nationality = gr.Dropdown(
                                    choices=NATIONALITIES, value="Korean",
                                    label="국적", info="여권 발급 국가 기준",
                                )
                                # P2-1: 복수국적 여부
                                dual_nationality = gr.Checkbox(
                                    label="복수국적 보유 (예: 한국-미국 이중국적)",
                                    value=False,
                                    info="복수국적 보유 시 보조 여권 기준 체류 가능 여부를 추가 안내합니다.",
                                )

                                # P1-1: 동반 여부 + 자녀 연령대
                                travel_type = gr.Radio(
                                    label="동반 여부",
                                    choices=["혼자 (솔로)", "배우자·파트너 동반", "자녀 동반 (배우자 없이)", "가족 전체 동반 (배우자 + 자녀)"],
                                    value="혼자 (솔로)",
                                )
                                with gr.Column(visible=False) as children_info_col:
                                    children_ages = gr.CheckboxGroup(
                                        label="자녀 연령대 (해당 항목 모두 선택)",
                                        choices=["영유아 (7세 이하)", "초등 (8~13세)", "중고등 (14~18세)"],
                                    )

                                # 변경 4: 배우자 소득 입력 (배우자 동반 시 노출)
                                with gr.Column(visible=False) as spouse_income_col:
                                    has_spouse_income = gr.Radio(
                                        label="배우자/파트너 수입이 있나요?",
                                        choices=["있음", "없음"],
                                        value="없음",
                                    )
                                    spouse_income_krw = gr.Slider(
                                        label="배우자 월 수입 (만원)",
                                        value=300,
                                        minimum=0,
                                        maximum=5000,
                                        step=100,
                                        visible=False,
                                    )

                                # 변경 4: 성인 자녀 소득 (가족 전체 동반 시 노출)
                                with gr.Column(visible=False) as adult_child_income_col:
                                    has_adult_child_income = gr.Radio(
                                        label="자녀가 20세 이상이며 소득이 있나요?",
                                        choices=["있음", "없음"],
                                        value="없음",
                                    )

                                # P0-1: Slider for income
                                income_krw = gr.Slider(
                                    label="월 소득 (만원)",
                                    value=500,
                                    minimum=100,
                                    maximum=5000,
                                    step=100,
                                    info="세전 월 소득 기준. 비자 신청 소득 기준 검토에 사용됩니다.",
                                )
                                # P0-2 / 변경 5-Q4: 소득 증빙 형태 (아코디언 Q4 통합, 5개 선택지)
                                income_type = gr.Dropdown(
                                    label="원격근무 계약 형태",
                                    choices=[
                                        "한국 법인 재직 (재직증명서 + 급여명세서)",
                                        "해외 법인 재직",
                                        "프리랜서 (계약서·해외 송금 내역)",
                                        "1인 사업자 (종합소득세 신고 기반)",
                                        "무소득 / 은퇴",
                                    ],
                                    value="한국 법인 재직 (재직증명서 + 급여명세서)",
                                    info="비자 신청 시 소득 증빙 방식이 신청 가능 비자를 결정합니다.",
                                )
                                immigration_purpose = gr.Dropdown(
                                    choices=STAY_PURPOSES,
                                    value=STAY_PURPOSES[0],
                                    label="장기 체류 목적",
                                )

                                # 변경 2: 준비 단계 질문 신규 추가
                                readiness_stage = gr.Radio(
                                    label="현재 준비 단계",
                                    choices=[
                                        "막연하게 고민 중 (6개월+ 후 실행 예상)",
                                        "구체적으로 준비 중 (3~6개월 내 출국 목표)",
                                        "이미 출국했거나 출국 임박",
                                    ],
                                    value="막연하게 고민 중 (6개월+ 후 실행 예상)",
                                )

                                # P1-4: "90일 이하" 옵션 추가
                                timeline = gr.Radio(
                                    choices=["90일 이하 (비자 없이 탐색)", "1년 단기 체험", "3년 장기 체류", "5년 이상 초장기 체류"],
                                    value="1년 단기 체험",
                                    label="목표 체류 기간",
                                )

                                lifestyle = gr.CheckboxGroup(
                                    choices=LIFESTYLE_OPTIONS,
                                    label="라이프스타일 선호",
                                    info="해당 항목 모두 선택",
                                )
                                languages = gr.CheckboxGroup(
                                    choices=LANGUAGE_OPTIONS,
                                    label="사용 가능 언어",
                                    info="가능한 언어 모두 선택",
                                )
                                preferred_countries = gr.CheckboxGroup(
                                    choices=CONTINENT_OPTIONS,
                                    label="관심 대륙 선택",
                                    info="선택한 대륙의 도시가 추천에 우선 반영됩니다. 선택하지 않으면 전체 대상으로 추천합니다.",
                                )

                                # 변경 5: 아코디언 개편 — Q1 CheckboxGroup 전환, Q5 선택지 확인
                                with gr.Accordion("🔍 내 노마드 유형 진단 (선택사항)", open=False):
                                    gr.Markdown("_질문으로 AI가 당신의 노마드 스타일을 파악합니다._")

                                    # Q1: Radio → CheckboxGroup, 선택지 순화
                                    q_motivation = gr.CheckboxGroup(
                                        choices=[
                                            "생활비 절감 / FIRE",
                                            "번아웃 회복 / 환경 전환",
                                            "유럽 장기 체류 (쉥겐 루프)",
                                            "한국 생활 리셋",
                                            "사업/프리랜서 거점 이전",
                                        ],
                                        label="Q1. 노마드 생활을 고려하는 주된 이유 (복수 선택, 선택사항)",
                                        value=[],
                                    )
                                    # Q2: 유지
                                    q_europe = gr.Radio(
                                        choices=["예 (유럽 루트 계획 있음)", "아니오"],
                                        label="Q2. 유럽에서 활동할 계획이 있나요?",
                                        value="아니오",
                                    )
                                    # Q5: 선택지 PM 문서 기준으로 확인 (·로 통일)
                                    q_concern = gr.CheckboxGroup(
                                        choices=["비자·체류일 관리", "생활비 예산", "세금·법적 문제", "건강보험 공백", "외로움·커뮤니티", "숙소 구하기"],
                                        label="걱정되는 항목을 모두 선택하세요",
                                        value=["생활비 예산"],
                                    )

                                # event handlers — 동반 구성에 따라 관련 컬럼 표시/숨김
                                travel_type.change(
                                    fn=lambda t: (
                                        gr.update(visible=t in ["자녀 동반 (배우자 없이)", "가족 전체 동반 (배우자 + 자녀)"]),
                                        gr.update(visible=t in ["배우자·파트너 동반", "가족 전체 동반 (배우자 + 자녀)"]),
                                        gr.update(visible=t == "가족 전체 동반 (배우자 + 자녀)"),
                                    ),
                                    inputs=[travel_type],
                                    outputs=[children_info_col, spouse_income_col, adult_child_income_col],
                                )
                                has_spouse_income.change(
                                    fn=lambda v: gr.update(visible=v == "있음"),
                                    inputs=[has_spouse_income],
                                    outputs=[spouse_income_krw],
                                )

                                # 소득·동반 인라인 경고 (입력 변경 시 즉시 노출)
                                income_warning = gr.Markdown(visible=False, value="")
                                companion_warning = gr.Markdown(visible=False, value="")

                                # 하드 경고 — 제출 버튼 바로 위
                                submit_warning = gr.Markdown(visible=False, value="")

                                btn_step1 = gr.Button(
                                    "🚀 도시 추천 받기", variant="primary", size="lg",
                                )
                                gr.Markdown("_⚠️ 본 서비스는 참고용이며 법적 비자/체류 조언이 아닙니다._")

                            # 결과 패널
                            with gr.Column(scale=1):
                                gr.Markdown("### 📊 추천 도시 TOP 3")
                                step1_output = gr.Markdown(
                                    "← 왼쪽에서 프로필을 입력하고 분석을 시작하세요."
                                )

                        # Step 1 완료 후 등장하는 Tab 2 진입 버튼
                        btn_go_step2 = gr.Button(
                            "📖 상세 가이드 받기 →",
                            variant="secondary",
                            size="lg",
                            visible=False,
                            elem_id="btn-go-step2",
                        )

                    # ── Tab 2: 상세 가이드 ─────────────────────────────────────
                    with gr.Tab("📖 상세 가이드", id=1):
                        with gr.Row():
                            with gr.Column(scale=1):
                                city_choice = gr.Radio(
                                    choices=["1순위 도시", "2순위 도시", "3순위 도시"],
                                    value="1순위 도시",
                                    label="상세 가이드를 받을 도시 선택",
                                )
                                btn_step2 = gr.Button(
                                    "📖 상세 가이드 받기",
                                    variant="primary",
                                    size="lg",
                                    elem_id="btn-step2",
                                )

                            with gr.Column(scale=2):
                                step2_output = gr.Markdown(
                                    "← Step 1을 먼저 완료한 후 도시를 선택하세요."
                                )

            with gr.Column(scale=1, min_width=320):
                gr.HTML(_create_ad_sidebar_html())

        # ── Step 1 이벤트 ──────────────────────────────────────────────
        def run_step1(nat, dual_nat, inc, inc_type, purpose, readiness_stage_val, life, langs, tl,
                      pref_countries, q_motiv, q_euro, q_concern_val,
                      travel_type_val, children_ages_val,
                      has_spouse_income_val, spouse_income_krw_val,
                      request: gr.Request | None = None):
            try:
                from utils.persona import diagnose_persona
                ui_lang = _resolve_ui_language(request=request)
                persona_type = diagnose_persona(q_motiv, q_euro, None, None, q_concern_val)
                # Show cycling overlay once — JS cycles messages automatically while
                # advisor_fn blocks. No Python-side sleep needed.
                yield (
                    gr.update(),
                    gr.update(),
                    gr.update(visible=False),
                    gr.update(),
                    gr.update(),
                    get_cycling_loading_html(_STEP1_LOADING_EN if ui_lang == "English" else _STEP1_LOADING),
                )
                markdown, cities, parsed = advisor_fn(
                    nat, inc, purpose, life, langs, tl, pref_countries, ui_lang, persona_type,
                    dual_nationality=dual_nat,
                    income_type=inc_type,
                    travel_type=travel_type_val, children_ages=children_ages_val,
                    readiness_stage=readiness_stage_val,
                    has_spouse_income=has_spouse_income_val,
                    spouse_income_krw=spouse_income_krw_val,
                )
                fallback_labels = (
                    ["1st city", "2nd city", "3rd city"]
                    if ui_lang == "English" else
                    ["1순위 도시", "2순위 도시", "3순위 도시"]
                )
                labels = [
                    _city_btn_label(cities[i], prefer_english=(ui_lang == "English")) if i < len(cities) else fallback_labels[i]
                    for i in range(3)
                ]
                yield (
                    markdown,
                    parsed,
                    gr.update(visible=True),
                    gr.update(),
                    gr.update(choices=labels, value=labels[0]),
                    LOADING_CLEAR,
                )
            except Exception as e:
                yield (
                    (f"⚠️ An error occurred: {str(e)}" if ui_lang == "English" else f"⚠️ 오류가 발생했습니다: {str(e)}"),
                    {},
                    gr.update(visible=False),
                    gr.update(),
                    gr.update(),
                    LOADING_CLEAR,
                )

        btn_step1.click(
            fn=run_step1,
            inputs=[
                nationality, dual_nationality, income_krw, income_type, immigration_purpose,
                readiness_stage,
                lifestyle, languages, timeline, preferred_countries,
                q_motivation, q_europe, q_concern,
                travel_type, children_ages,
                has_spouse_income, spouse_income_krw,
            ],
            outputs=[step1_output, parsed_state, btn_go_step2, tabs, city_choice, loading_overlay],
        )

        # ── 경고 이벤트 연결 ────────────────────────────────────────────
        # check_income_warning: 소득·대륙·동반·기간 변경 시 호출
        # outputs: [income_warning, submit_warning, btn_step1]
        _income_warning_inputs = [income_krw, preferred_countries, travel_type, timeline]
        for _trigger in _income_warning_inputs:
            _trigger.change(
                fn=check_income_warning,
                inputs=_income_warning_inputs,
                outputs=[income_warning, submit_warning, btn_step1],
            )

        # check_companion_warning: 동반 유형 또는 배우자 소득 여부 변경 시 호출
        # outputs: [companion_warning]
        travel_type.change(
            fn=check_companion_warning,
            inputs=[travel_type, has_spouse_income],
            outputs=[companion_warning],
        )
        has_spouse_income.change(
            fn=check_companion_warning,
            inputs=[travel_type, has_spouse_income],
            outputs=[companion_warning],
        )

        # Step 2 탭으로 이동 (로그인 체크)
        btn_go_step2.click(
            fn=lambda: gr.update(selected=1),
            inputs=[],
            outputs=[tabs],
        )

        # ── Step 2 이벤트 ──────────────────────────────────────────────
        def run_step2(parsed, choice):
            try:
                ui_lang = parsed.get("_user_profile", {}).get("language", "한국어") if isinstance(parsed, dict) else "한국어"
                static_map = {
                    "1순위 도시": 0, "2순위 도시": 1, "3순위 도시": 2,
                    "1st city": 0, "2nd city": 1, "3rd city": 2,
                }
                if choice in static_map:
                    idx = static_map[choice]
                else:
                    cities = parsed.get("top_cities", [])
                    dynamic_labels = [
                        _city_btn_label(c, prefer_english=(ui_lang == "English"))
                        for c in cities
                    ]
                    idx = dynamic_labels.index(choice) if choice in dynamic_labels else 0
                yield gr.update(), get_cycling_loading_html(_STEP2_LOADING_EN if ui_lang == "English" else _STEP2_LOADING)
                markdown = detail_fn(parsed, city_index=idx)
                yield markdown, LOADING_CLEAR
            except Exception as e:
                import traceback
                traceback.print_exc()
                ui_lang = parsed.get("_user_profile", {}).get("language", "한국어") if isinstance(parsed, dict) else "한국어"
                msg = f"⚠️ An error occurred: {str(e)}" if ui_lang == "English" else f"⚠️ 오류가 발생했습니다: {str(e)}"
                yield msg, LOADING_CLEAR

        btn_step2.click(
            fn=run_step2,
            inputs=[parsed_state, city_choice],
            outputs=[step2_output, loading_overlay],
        )

        # ── 앱 초기 로딩 완료 시 오버레이 클리어 ──────────────────────
        demo.load(fn=lambda: LOADING_CLEAR, outputs=[loading_overlay])

    return demo
