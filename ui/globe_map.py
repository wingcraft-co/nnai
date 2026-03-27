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
  display:none;position:fixed;inset:0;background:rgba(0,5,20,.88);
  z-index:9000;align-items:center;justify-content:center;backdrop-filter:blur(8px);
}
#nnai-map-modal-bg.open{display:flex;animation:nnaiMapFadeIn .25s ease;}
@keyframes nnaiMapFadeIn{from{opacity:0}to{opacity:1}}
#nnai-map-modal{
  width:95vw;max-width:1100px;background:#0d1b2a;border-radius:18px;
  overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.9),0 0 0 1px rgba(79,195,247,.12);
  animation:nnaiMapSlideUp .35s cubic-bezier(.34,1.56,.64,1);
}
@keyframes nnaiMapSlideUp{from{transform:translateY(28px) scale(.97);opacity:0}to{transform:none;opacity:1}}

/* Map top bar */
#nnai-map-top{background:linear-gradient(135deg,#0C447C,#1a6cc8);padding:12px 18px;display:flex;align-items:center;justify-content:space-between;}
#nnai-map-top h2{font-size:.95rem;color:#fff;margin:0;}
#nnai-map-top p{font-size:.72rem;color:rgba(255,255,255,.6);margin:2px 0 0;}
#nnai-map-close{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
#nnai-map-close:hover{background:rgba(255,255,255,.28);}

/* Login CTA */
#nnai-login-cta{background:linear-gradient(90deg,rgba(255,140,0,.12),rgba(255,193,7,.07));border-bottom:1px solid rgba(255,160,0,.2);padding:8px 18px;display:flex;align-items:center;gap:10px;}
#nnai-login-cta span{font-size:.78rem;color:rgba(255,255,255,.82);flex:1;}
#nnai-login-cta strong{color:#FFD54F;}
#nnai-google-btn{display:flex;align-items:center;gap:6px;background:#fff;color:#333;border:none;border-radius:20px;padding:5px 12px;cursor:pointer;font-size:.74rem;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.3);white-space:nowrap;text-decoration:none;}

/* User info (logged in) */
#nnai-user-bar{background:rgba(79,195,247,.06);border-bottom:1px solid rgba(79,195,247,.12);padding:6px 18px;display:none;align-items:center;gap:10px;}
#nnai-user-bar img{width:26px;height:26px;border-radius:50%;}
#nnai-user-bar span{font-size:.78rem;color:rgba(255,255,255,.8);flex:1;}
#nnai-logout-btn{font-size:.72rem;color:rgba(255,255,255,.4);background:none;border:none;cursor:pointer;text-decoration:underline;}

/* Search */
#nnai-search-wrap{position:relative;padding:9px 14px;background:#081423;border-bottom:1px solid rgba(255,255,255,.06);display:flex;gap:8px;align-items:center;}
#nnai-search-icon{position:absolute;left:24px;top:50%;transform:translateY(-50%);font-size:13px;color:rgba(255,255,255,.35);pointer-events:none;}
#nnai-search-input{flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(79,195,247,.28);border-radius:9px;color:#fff;font-size:.83rem;padding:7px 12px 7px 32px;outline:none;transition:border-color .2s;}
#nnai-search-input:focus{border-color:#4FC3F7;}
#nnai-search-input::placeholder{color:rgba(255,255,255,.28);}
#nnai-search-status{font-size:.7rem;color:rgba(255,255,255,.3);min-width:60px;}
#nnai-ac{position:absolute;top:100%;left:14px;right:14px;background:#0d1e30;border:1px solid rgba(79,195,247,.22);border-radius:9px;overflow:hidden;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.6);display:none;}
#nnai-ac.open{display:block;}
.nnai-ac-item{padding:8px 13px;cursor:pointer;display:flex;align-items:center;gap:9px;font-size:.8rem;border-bottom:1px solid rgba(255,255,255,.05);transition:background .12s;}
.nnai-ac-item:last-child{border-bottom:none;}
.nnai-ac-item:hover,.nnai-ac-item.hi{background:rgba(79,195,247,.11);}
.nnai-ac-flag{font-size:16px;}
.nnai-ac-name{color:#fff;font-weight:500;}
.nnai-ac-sub{color:rgba(255,255,255,.38);font-size:.69rem;margin-top:1px;}
.nnai-ac-spin{width:13px;height:13px;border:2px solid rgba(79,195,247,.2);border-top-color:#4FC3F7;border-radius:50%;animation:nnaiSpin .7s linear infinite;display:inline-block;}
@keyframes nnaiSpin{to{transform:rotate(360deg)}}

/* Map */
#nnai-leaflet-map{width:100%;height:400px;}
.leaflet-tile{filter:brightness(.7) saturate(.6) hue-rotate(185deg);}
.leaflet-popup-content-wrapper{background:#0d1b2a!important;border:1px solid rgba(79,195,247,.3)!important;color:#fff!important;border-radius:9px!important;}
.leaflet-popup-tip{background:#0d1b2a!important;}

/* Stats */
#nnai-stats-bar{background:#060e1a;border-top:1px solid rgba(255,255,255,.05);padding:7px 18px;display:flex;align-items:center;gap:16px;}
.nnai-stat{display:flex;align-items:center;gap:5px;font-size:.74rem;color:rgba(255,255,255,.55);}
.nnai-stat strong{color:#4FC3F7;}
.nnai-sdot{width:9px;height:9px;border-radius:50%;}
#nnai-loc-status{margin-left:auto;font-size:.7rem;padding:3px 9px;border-radius:9px;}
.nnai-loc-ok{background:rgba(76,175,80,.14);color:#81C784;border:1px solid rgba(76,175,80,.28);}
.nnai-loc-off{background:rgba(255,100,0,.1);color:#FF8A65;border:1px solid rgba(255,100,0,.2);}

/* Pin popup (modal inside modal) */
#nnai-pin-bg{display:none;position:fixed;inset:0;z-index:9500;align-items:center;justify-content:center;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);}
#nnai-pin-bg.open{display:flex;}
#nnai-pin-box{background:#0d1b2a;border:1px solid rgba(79,195,247,.22);border-radius:15px;padding:22px 24px;width:340px;box-shadow:0 16px 48px rgba(0,0,0,.8);}
#nnai-pin-title{font-size:.95rem;font-weight:600;margin-bottom:3px;color:#fff;}
#nnai-pin-sub{font-size:.72rem;color:rgba(255,255,255,.45);margin-bottom:14px;}
.nnai-pp-label{font-size:.72rem;color:rgba(255,255,255,.45);margin:10px 0 4px;}
.nnai-pp-input{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(79,195,247,.22);border-radius:7px;color:#fff;padding:8px 11px;font-size:.82rem;outline:none;box-sizing:border-box;}
.nnai-pp-input:focus{border-color:#4FC3F7;}
#nnai-pin-loc{margin-top:12px;border-radius:7px;padding:8px 11px;font-size:.73rem;display:flex;align-items:center;gap:6px;}
.nnai-loc-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
#nnai-pin-actions{display:flex;gap:7px;margin-top:16px;}
#nnai-pin-cancel{flex:1;padding:8px;border-radius:7px;background:rgba(255,255,255,.07);border:none;color:rgba(255,255,255,.55);cursor:pointer;font-size:.79rem;}
#nnai-pin-save{flex:2;padding:8px;border-radius:7px;background:linear-gradient(135deg,#FF8C00,#FFA500);border:none;color:#fff;cursor:pointer;font-size:.79rem;font-weight:600;box-shadow:0 3px 10px rgba(255,140,0,.35);}
#nnai-pin-save:hover{filter:brightness(1.08);}

/* Toast */
#nnai-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(16px);background:#1a2f45;border:1px solid rgba(79,195,247,.28);color:#fff;padding:9px 18px;border-radius:28px;font-size:.79rem;opacity:0;transition:all .3s;z-index:9999;white-space:nowrap;pointer-events:none;}
#nnai-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
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
"""
