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
<div id="nnai-map-modal-bg">
  <div id="nnai-map-modal">

    <div id="nnai-map-top">
      <div>
        <h2>🗺️ 나의 노마드 방명록</h2>
        <p>방문한 도시를 검색해서 핀을 남겨보세요</p>
      </div>
      <button id="nnai-map-close">✕</button>
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
        placeholder="도시 검색... 쿠알라룸푸르, Tbilisi, Budapest 등 어떤 언어도 OK"/>
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

<script>
(function(){
'use strict';

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
  _map.on('click', function(){});  // prevent accidental close
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
function checkAuth(){
  fetch('/auth/me').then(function(r){return r.json();}).then(function(d){
    if(d.logged_in){
      _userId=d.uid;
      $('nnai-login-cta').style.display='none';
      var bar=$('nnai-user-bar'); bar.style.display='flex';
      $('nnai-user-name').textContent=d.name+' 님의 지도';
      if(d.picture) $('nnai-user-pic').src=d.picture;
      loadMyPins();
    }
  });
}

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
  // 로컬 퍼지 서치 즉시
  var local=LOCAL_CITIES.filter(function(c){return fuzzyMatch(c.name,val)||fuzzyMatch(c.country,val);});
  _acResults=local.slice();
  if(_acResults.length) renderAc();
  // Nominatim 디바운스
  setSearchStatus('<div class="nnai-ac-spin"></div>');
  _debounce=setTimeout(function(){nominatimSearch(val);},400);
}

function nominatimSearch(q){
  var url='https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(q)
    +'&format=json&limit=6&accept-language=ko,en&addressdetails=1';
  fetch(url,{headers:{'Accept-Language':'ko,en'}})
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

  // 위치 검증
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

/* ── 핀 저장 ── */
function savePin(){
  var c=_selCity; if(!c) return;
  if(!_userId){showToast('로그인 후 핀을 저장할 수 있어요');return;}
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
    // Ripple
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
  else{_map.invalidateSize();}
};
window.nnaiCloseMap=function(){$('nnai-map-modal-bg').classList.remove('open');};

/* ── 이벤트 바인딩 ── */
$('nnai-map-close').onclick=window.nnaiCloseMap;
$('nnai-map-modal-bg').onclick=function(e){if(e.target===this)window.nnaiCloseMap();};
$('nnai-search-input').addEventListener('input',onSearchInput);
$('nnai-search-input').addEventListener('keydown',function(e){
  var items=$('nnai-ac').querySelectorAll('.nnai-ac-item');
  if(e.key==='ArrowDown'){_acHi=Math.min(_acHi+1,items.length-1);hiAc(_acHi);e.preventDefault();}
  else if(e.key==='ArrowUp'){_acHi=Math.max(_acHi-1,0);hiAc(_acHi);e.preventDefault();}
  else if(e.key==='Enter'&&_acHi>=0){selectCity(_acHi);}
  else if(e.key==='Escape'){closeAc();}
});
$('nnai-search-input').addEventListener('blur',function(){setTimeout(closeAc,200);});
$('nnai-pin-cancel').onclick=closePinPopup;
$('nnai-pin-save').onclick=savePin;
$('nnai-pp-note').addEventListener('keydown',function(e){if(e.key==='Enter')savePin();});

})();
</script>
"""
