# ui/globe_map.py
"""세계지도 모달 HTML 문자열 생성."""


def build_globe_map_html() -> str:
    """
    Leaflet.js 세계지도 모달 + 도시 검색 + 핀 추가 UI.
    gr.HTML(value=build_globe_map_html()) 로 주입.
    """
    return """
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

<style>
#nnai-map-modal-bg{
  display:none!important;position:fixed!important;inset:0!important;background:rgba(0,5,20,.88)!important;
  z-index:9000!important;align-items:center!important;justify-content:center!important;backdrop-filter:blur(8px)!important;
}
#nnai-map-modal-bg.open{display:flex!important;animation:nnaiMapFadeIn .25s ease!important;}
@keyframes nnaiMapFadeIn{from{opacity:0}to{opacity:1}}
#nnai-map-modal{
  width:95vw!important;max-width:1100px!important;background:#0d1b2a!important;border-radius:18px!important;
  overflow:hidden!important;box-shadow:0 24px 80px rgba(0,0,0,.9),0 0 0 1px rgba(79,195,247,.12)!important;
  animation:nnaiMapSlideUp .35s cubic-bezier(.34,1.56,.64,1)!important;
}
@keyframes nnaiMapSlideUp{from{transform:translateY(28px) scale(.97);opacity:0}to{transform:none;opacity:1}}

/* Map top bar */
#nnai-map-top{background:linear-gradient(135deg,#0C447C,#1a6cc8)!important;padding:12px 18px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;}
#nnai-map-top h2{font-size:.95rem!important;color:#fff!important;margin:0!important;}
#nnai-map-top p{font-size:.72rem!important;color:rgba(255,255,255,.6)!important;margin:2px 0 0!important;}
#nnai-map-close{width:28px!important;height:28px!important;border-radius:50%!important;background:rgba(255,255,255,.15)!important;border:none!important;color:#fff!important;font-size:15px!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;}
#nnai-map-close:hover{background:rgba(255,255,255,.28)!important;}

/* Login CTA */
#nnai-login-cta{background:linear-gradient(90deg,rgba(255,140,0,.12),rgba(255,193,7,.07))!important;border-bottom:1px solid rgba(255,160,0,.2)!important;padding:8px 18px!important;display:flex!important;align-items:center!important;gap:10px!important;}
#nnai-login-cta span{font-size:.78rem!important;color:rgba(255,255,255,.82)!important;flex:1!important;}
#nnai-login-cta strong{color:#FFD54F!important;}
#nnai-google-btn{display:flex!important;align-items:center!important;gap:6px!important;background:#fff!important;color:#333!important;border:none!important;border-radius:20px!important;padding:5px 12px!important;cursor:pointer!important;font-size:.74rem!important;font-weight:600!important;box-shadow:0 2px 8px rgba(0,0,0,.3)!important;white-space:nowrap!important;text-decoration:none!important;}

/* User info (logged in) */
#nnai-user-bar{background:rgba(79,195,247,.06)!important;border-bottom:1px solid rgba(79,195,247,.12)!important;padding:6px 18px!important;display:none!important;align-items:center!important;gap:10px!important;}
#nnai-user-bar img{width:26px!important;height:26px!important;border-radius:50%!important;}
#nnai-user-bar span{font-size:.78rem!important;color:rgba(255,255,255,.8)!important;flex:1!important;}
#nnai-logout-btn{font-size:.72rem!important;color:rgba(255,255,255,.4)!important;background:none!important;border:none!important;cursor:pointer!important;text-decoration:underline!important;}

/* Search */
#nnai-search-wrap{position:relative!important;padding:9px 14px!important;background:#081423!important;border-bottom:1px solid rgba(255,255,255,.06)!important;display:flex!important;gap:8px!important;align-items:center!important;}
#nnai-search-icon{position:absolute!important;left:24px!important;top:50%!important;transform:translateY(-50%)!important;font-size:13px!important;color:rgba(255,255,255,.35)!important;pointer-events:none!important;}
#nnai-search-input{flex:1!important;background:rgba(255,255,255,.07)!important;border:1px solid rgba(79,195,247,.28)!important;border-radius:9px!important;color:#fff!important;font-size:.83rem!important;padding:7px 12px 7px 32px!important;outline:none!important;transition:border-color .2s!important;}
#nnai-search-input:focus{border-color:#4FC3F7!important;}
#nnai-search-input::placeholder{color:rgba(255,255,255,.28)!important;}
#nnai-search-status{font-size:.7rem!important;color:rgba(255,255,255,.3)!important;min-width:60px!important;}
#nnai-ac{position:absolute!important;top:100%!important;left:14px!important;right:14px!important;background:#0d1e30!important;border:1px solid rgba(79,195,247,.22)!important;border-radius:9px!important;overflow:hidden!important;z-index:9999!important;box-shadow:0 8px 32px rgba(0,0,0,.6)!important;display:none!important;}
#nnai-ac.open{display:block!important;}
.nnai-ac-item{padding:8px 13px!important;cursor:pointer!important;display:flex!important;align-items:center!important;gap:9px!important;font-size:.8rem!important;border-bottom:1px solid rgba(255,255,255,.05)!important;transition:background .12s!important;color:#fff!important;}
.nnai-ac-item:last-child{border-bottom:none!important;}
.nnai-ac-item:hover,.nnai-ac-item.hi{background:rgba(79,195,247,.11)!important;}
.nnai-ac-flag{font-size:16px!important;}
.nnai-ac-name{color:#fff!important;font-weight:500!important;}
.nnai-ac-sub{color:rgba(255,255,255,.38)!important;font-size:.69rem!important;margin-top:1px!important;}
.nnai-ac-spin{width:13px!important;height:13px!important;border:2px solid rgba(79,195,247,.2)!important;border-top-color:#4FC3F7!important;border-radius:50%!important;animation:nnaiSpin .7s linear infinite!important;display:inline-block!important;}
@keyframes nnaiSpin{to{transform:rotate(360deg)}}

/* Map */
#nnai-leaflet-map{width:100%!important;height:400px!important;}
.leaflet-tile{filter:brightness(.7) saturate(.6) hue-rotate(185deg)!important;}
.leaflet-popup-content-wrapper{background:#0d1b2a!important;border:1px solid rgba(79,195,247,.3)!important;color:#fff!important;border-radius:9px!important;}
.leaflet-popup-tip{background:#0d1b2a!important;}

/* Stats */
#nnai-stats-bar{background:#060e1a!important;border-top:1px solid rgba(255,255,255,.05)!important;padding:7px 18px!important;display:flex!important;align-items:center!important;gap:16px!important;}
.nnai-stat{display:flex!important;align-items:center!important;gap:5px!important;font-size:.74rem!important;color:rgba(255,255,255,.55)!important;}
.nnai-stat strong{color:#4FC3F7!important;}
.nnai-sdot{width:9px!important;height:9px!important;border-radius:50%!important;}
#nnai-loc-status{margin-left:auto!important;font-size:.7rem!important;padding:3px 9px!important;border-radius:9px!important;}
.nnai-loc-ok{background:rgba(76,175,80,.14)!important;color:#81C784!important;border:1px solid rgba(76,175,80,.28)!important;}
.nnai-loc-off{background:rgba(255,100,0,.1)!important;color:#FF8A65!important;border:1px solid rgba(255,100,0,.2)!important;}

/* Pin popup (modal inside modal) */
#nnai-pin-bg{display:none!important;position:fixed!important;inset:0!important;z-index:9500!important;align-items:center!important;justify-content:center!important;background:rgba(0,5,20,.88)!important;backdrop-filter:blur(8px)!important;}
#nnai-pin-bg.open{display:flex!important;}
#nnai-pin-box{background:#0d1b2a!important;border:1px solid rgba(79,195,247,.22)!important;border-radius:15px!important;padding:22px 24px!important;width:340px!important;box-shadow:0 16px 48px rgba(0,0,0,.4),0 0 0 1px rgba(79,195,247,.12)!important;}
#nnai-pin-title{font-size:.95rem!important;font-weight:600!important;margin-bottom:3px!important;color:#fff!important;}
#nnai-pin-sub{font-size:.72rem!important;color:rgba(255,255,255,.55)!important;margin-bottom:14px!important;}
.nnai-pp-label{font-size:.72rem!important;color:rgba(255,255,255,.65)!important;margin:10px 0 4px!important;}
.nnai-pp-input{width:100%!important;background:rgba(79,195,247,.05)!important;border:1px solid rgba(79,195,247,.22)!important;border-radius:7px!important;color:#fff!important;padding:8px 11px!important;font-size:.82rem!important;outline:none!important;box-sizing:border-box!important;}
.nnai-pp-input:focus{border-color:#4FC3F7!important;background:rgba(79,195,247,.1)!important;}
.nnai-pp-input::placeholder{color:rgba(255,255,255,.3)!important;}
.nnai-pp-input:read-only{background:rgba(79,195,247,.02)!important;border-color:rgba(79,195,247,.15)!important;color:rgba(255,255,255,.45)!important;cursor:default!important;}
#nnai-pin-loc{margin-top:12px!important;border-radius:7px!important;padding:8px 11px!important;font-size:.73rem!important;display:flex!important;align-items:center!important;gap:6px!important;background:rgba(79,195,247,.06)!important;color:rgba(255,255,255,.65)!important;border:1px solid rgba(79,195,247,.12)!important;}
.nnai-loc-dot{width:7px!important;height:7px!important;border-radius:50%!important;flex-shrink:0!important;}
#nnai-pin-actions{display:flex!important;gap:7px!important;margin-top:16px!important;}
#nnai-pin-cancel{flex:1!important;padding:8px!important;border-radius:7px!important;background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.1)!important;color:rgba(255,255,255,.7)!important;cursor:pointer!important;font-size:.79rem!important;transition:all .2s!important;}
#nnai-pin-cancel:hover{background:rgba(255,255,255,.12)!important;color:#fff!important;}
#nnai-pin-save{flex:2!important;padding:8px!important;border-radius:7px!important;background:linear-gradient(135deg,#FF8C00,#FFA500)!important;border:none!important;color:#fff!important;cursor:pointer!important;font-size:.79rem!important;font-weight:600!important;box-shadow:0 3px 10px rgba(255,140,0,.35)!important;transition:all .2s!important;}
#nnai-pin-save:hover{filter:brightness(1.08)!important;}
@keyframes nnaiLoginShake{0%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}100%{transform:translateX(0)}}

/* Toast */
#nnai-toast{position:fixed!important;bottom:28px!important;left:50%!important;transform:translateX(-50%) translateY(16px)!important;background:#1a2f45!important;border:1px solid rgba(79,195,247,.28)!important;color:#fff!important;padding:9px 18px!important;border-radius:28px!important;font-size:.79rem!important;opacity:0!important;transition:all .3s!important;z-index:9999!important;white-space:nowrap!important;pointer-events:none!important;}
#nnai-toast.show{opacity:1!important;transform:translateX(-50%) translateY(0)!important;}
</style>

<!-- Modal markup -->
<div id="nnai-map-modal-bg" onclick="if(event.target === this) this.classList.remove('open');">
  <div id="nnai-map-modal">

    <div id="nnai-map-top">
      <div>
        <h2>🗺️ 나의 노마드 방명록</h2>
        <p>방문한 도시를 검색해서 핀을 남겨보세요</p>
      </div>
      <button id="nnai-map-close" onclick="document.getElementById('nnai-map-modal-bg').classList.remove('open');">✕</button>
    </div>

    <!-- 비로그인 CTA -->
    <div id="nnai-login-cta">
      <span>✨ <strong>로그인하고 나만의 디지털 노마드 지도를 완성해보세요!</strong></span>
      <a id="nnai-google-btn" href="/auth/google">
        <svg width="15" height="15" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Google로 로그인
      </a>
    </div>

    <!-- 로그인 후 유저 바 -->
    <div id="nnai-user-bar">
      <img id="nnai-user-pic" src="" alt=""/>
      <span id="nnai-user-name"></span>
      <a id="nnai-logout-btn" href="/auth/logout">로그아웃</a>
    </div>

    <!-- 검색 -->
    <div id="nnai-search-wrap">
      <span id="nnai-search-icon">🔍</span>
      <input id="nnai-search-input" autocomplete="off"
        placeholder="도시 검색... 쿠알라룸푸르, Tbilisi, Budapest 등 어떤 언어도 OK"
        oninput="if(typeof onSearchInput !== 'undefined') onSearchInput();"
        onkeydown="if(typeof onSearchInput !== 'undefined' && event.key === 'Enter') event.preventDefault();"
        />
      <span id="nnai-search-status"></span>
      <div id="nnai-ac"></div>
    </div>

    <div id="nnai-leaflet-map"></div>

    <div id="nnai-stats-bar">
      <div class="nnai-stat">
        <div class="nnai-sdot" style="background:#4FC3F7;box-shadow:0 0 5px rgba(79,195,247,.7)"></div>
        커뮤니티 핀 <strong id="nnai-com-count">-</strong>
      </div>
      <div class="nnai-stat">
        <div class="nnai-sdot" style="background:#FF8C00;box-shadow:0 0 5px rgba(255,140,0,.8)"></div>
        나의 핀 <strong id="nnai-my-count">0</strong>
      </div>
      <div id="nnai-loc-status" class="nnai-loc-off">📍 위치 확인 중...</div>
    </div>
  </div>
</div>

<!-- Pin 추가 팝업 -->
<div id="nnai-pin-bg">
  <div id="nnai-pin-box">
    <div id="nnai-pin-title">📍 핀 추가</div>
    <div id="nnai-pin-sub"></div>
    <div class="nnai-pp-label">도시명</div>
    <input class="nnai-pp-input" id="nnai-pp-city" readonly style="color:rgba(255,255,255,.5);cursor:default"/>
    <div class="nnai-pp-label">한줄평</div>
    <input class="nnai-pp-input" id="nnai-pp-note" placeholder="예: 코워킹 천국, 한달살기 최고 🙌" maxlength="60"/>
    <div id="nnai-pin-loc">
      <div class="nnai-loc-dot" id="nnai-pp-dot"></div>
      <span id="nnai-pp-loc-text">위치 확인 중...</span>
    </div>
    <div id="nnai-pin-actions">
      <button id="nnai-pin-cancel">취소</button>
      <button id="nnai-pin-save">✓ 핀 저장하기</button>
    </div>
  </div>
</div>

<div id="nnai-toast"></div>

<!-- 로그인 유도 팝업 -->
<div id="nnai-login-popup-bg" style="display:none!important;position:fixed!important;inset:0!important;z-index:9500!important;align-items:center!important;justify-content:center!important;background:rgba(0,5,20,.88)!important;backdrop-filter:blur(8px)!important;">
  <div style="background:#0d1b2a!important;border:1px solid rgba(79,195,247,.22)!important;border-radius:15px!important;padding:28px 24px!important;width:340px!important;box-shadow:0 16px 48px rgba(0,0,0,.4),0 0 0 1px rgba(79,195,247,.12)!important;">
    <div style="text-align:center!important;">
      <div style="font-size:2.5rem!important;margin-bottom:12px!important;">✨</div>
      <div style="font-size:.95rem!important;font-weight:600!important;margin-bottom:8px!important;color:#fff!important;">핀을 저장하고</div>
      <div style="font-size:.95rem!important;font-weight:600!important;margin-bottom:16px!important;color:#fff!important;">내 디지털노마드 지도를 완성해보세요!</div>
      <div style="font-size:.78rem!important;color:rgba(255,255,255,.55)!important;margin-bottom:20px!important;line-height:1.5!important;">방문한 도시의 핀을 저장하고<br/>나만의 노마드 여정을 기록해보세요</div>
    </div>
    <div style="display:flex!important;gap:8px!important;margin-top:16px!important;">
      <button id="nnai-login-popup-cancel" style="flex:1!important;padding:10px!important;border-radius:7px!important;background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.1)!important;color:rgba(255,255,255,.7)!important;cursor:pointer!important;font-size:.79rem!important;transition:all .2s!important;font-weight:500!important;">닫기</button>
      <a href="/auth/google" style="flex:1.5!important;padding:10px!important;border-radius:7px!important;background:linear-gradient(135deg,#FF8C00,#FFA500)!important;border:none!important;color:#fff!important;cursor:pointer!important;font-size:.79rem!important;font-weight:600!important;box-shadow:0 3px 10px rgba(255,140,0,.35)!important;text-decoration:none!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;transition:all .2s!important;">
        <svg width="14" height="14" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#fff"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/>
        </svg>
        로그인
      </a>
    </div>
  </div>
</div>
"""
