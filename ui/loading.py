# ui/loading.py
"""
Loading overlay component for NomadNavigator AI.

Exports:
    get_loading_html(message) -> str   Full-screen overlay HTML with canvas animation
    LOADING_CLEAR               str   Empty string — clears the overlay when yielded to gr.HTML
    HEADER_GLOBE_HTML           str   Small always-on globe canvas for the header logo
"""

import html as _html

LOADING_CLEAR = ""

# Animation script kept as a separate constant so get_loading_html can use
# plain string concatenation, avoiding f-string brace-escaping issues with JS.
#
# Key safety features:
#   window.__nnaiRAF guard  — cancels previous RAF loop before starting a new one,
#                             preventing duplicate loops when Gradio re-executes the
#                             <script> tag on each intermediate loading yield.
#   canvas.isConnected check — auto-stops the loop when Gradio clears the gr.HTML
#                              component (sets innerHTML to ""), which detaches the
#                              canvas from the DOM.
_ANIM_SCRIPT = """<script>
(function(){
if(window.__nnaiRAF)cancelAnimationFrame(window.__nnaiRAF);

/* World map: 24 cols x 12 rows  (1=land, 0=ocean)
   col 0 = -180 deg lon, col 23 = +165 deg lon, each col ~15 deg
   row 0 = 75-90 deg N,  row 11 = 75-90 deg S,  each row ~15 deg */
var W=[
  [0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [1,1,0,0,0,0,0,0,0,0,1,1,1,0,1,1,1,1,1,1,1,1,0,0],
  [1,1,0,1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,0,0,0,1,1,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,0,0,1,0,0,0,1,1,1,1,1,0,1,1,1,1,0,0,0],
  [0,0,0,0,0,0,0,0,1,1,1,0,0,1,1,1,0,0,0,1,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,0,0,0,1,0,0,0,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
var MC=24,MR=12,PS=4;
var LAND=['#1B5E20','#2E7D32','#43A047','#66BB6A'];
var OCEAN=['#0A1F6B','#0D47A1','#1565C0','#1E88E5'];
var ICE=['#B0C4DE','#D6EAF8','#EBF5FB'];
function sh(p,l){return p[Math.min(p.length-1,Math.floor(l*p.length))];}

function drawEarth(ctx,cx,cy,r,ang){
  for(var py=-r;py<r;py+=PS){
    for(var px=-r;px<r;px+=PS){
      var pc=px+PS/2,pcy=py+PS/2,d2=pc*pc+pcy*pcy;
      if(d2>r*r)continue;
      var z=Math.sqrt(r*r-d2);
      var lat=Math.asin(-pcy/r);
      var lon=((Math.atan2(pc,z)-ang)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
      var mc=Math.floor(lon/(2*Math.PI)*MC)%MC;
      var mr=Math.max(0,Math.min(MR-1,Math.floor((Math.PI/2-lat)/Math.PI*MR)));
      var light=z/r;
      var col;
      if(mr===0||mr>=10)col=sh(ICE,light);
      else if(W[mr][mc]===1)col=sh(LAND,light);
      else col=sh(OCEAN,light);
      ctx.fillStyle=col;
      ctx.fillRect(Math.round(cx+px),Math.round(cy+py),PS,PS);
    }
  }
  /* polar ice caps (fixed, non-rotating) */
  ctx.save();ctx.globalAlpha=0.65;ctx.fillStyle='#D6EAF8';
  ctx.beginPath();ctx.arc(cx,cy-r+PS,r*0.25,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(cx,cy+r-PS,r*0.32,0,Math.PI*2);ctx.fill();
  ctx.restore();
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.strokeStyle='rgba(120,190,255,0.5)';ctx.lineWidth=1.5;ctx.stroke();
}

/* s-character (Korean: s shape)
   6 cols x 10 rows at scale=5px, forward-facing, legs walk left */
var Y='#FFE082',D='#F9A825',K='#2C1A00',T=null;
var BODY=[[T,T,Y,Y,T,T],[T,Y,Y,Y,Y,T],[Y,Y,K,Y,K,Y],
          [Y,Y,Y,Y,Y,Y],[T,Y,Y,Y,Y,T],[T,T,Y,Y,T,T]];
var LEGS=[
  [[Y,T,T,T,T,Y],[Y,T,T,T,Y,T]],
  [[T,Y,Y,Y,T,T],[T,Y,T,Y,T,T]],
  [[Y,T,T,T,T,Y],[T,Y,T,T,T,Y]],
  [[T,Y,Y,Y,T,T],[T,Y,T,Y,T,T]]
];
var BOB=[0,1,0,1];
function drawChar(ctx,ox,oy,sc,frame){
  var f=frame&3;
  var by=BOB[f]*sc;
  var rows=BODY.concat(LEGS[f]);
  for(var r=0;r<rows.length;r++){
    var isLeg=r>=BODY.length;
    var yOff=isLeg?0:by;
    for(var c=0;c<rows[r].length;c++){
      var col=rows[r][c];if(!col)continue;
      ctx.fillStyle=col;
      ctx.fillRect(ox+c*sc,oy+r*sc+yOff,sc,sc);
      if(col===Y){ctx.fillStyle=D;ctx.fillRect(ox+c*sc,oy+r*sc+yOff+sc-1,sc,1);}
    }
  }
}

/* Animation loop
   Canvas: 88x108px
   Globe:  radius=34, center=(44, 70)  [70 = 108-34-4]
   Char:   charX=29 [44-3*5], charY=-4 [70-34-8*5]
           body bottom at globe top (y=36), legs overlap into globe */
var angle=0,tick=0,wf=0;
function loop(){
  var canvas=document.getElementById('nnai-globe-canvas');
  if(!canvas||!canvas.isConnected){
    if(window.__nnaiMsgInterval){clearInterval(window.__nnaiMsgInterval);window.__nnaiMsgInterval=null;}
    window.__nnaiRAF=null;return;
  }
  var ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,88,108);
  angle-=0.014;
  tick++;
  if(tick%10===0)wf++;
  drawEarth(ctx,44,70,34,angle);
  drawChar(ctx,29,-4,5,wf);
  window.__nnaiRAF=requestAnimationFrame(loop);
}
window.__nnaiRAF=requestAnimationFrame(loop);
})();
</script>"""


def get_cycling_loading_html(messages: list, interval_ms: int = 2500) -> str:
    """Return a full-screen loading overlay that cycles through *messages* automatically.

    The first message is shown immediately; subsequent messages replace it
    every *interval_ms* milliseconds via JS setInterval running in the browser.
    When the overlay is cleared (canvas disconnects), the interval is stopped
    by the RAF loop's isConnected cleanup branch.

    Use this for long-running LLM calls so users see live progress updates
    without requiring intermediate Python yields.
    """
    import json as _json
    escaped = [_html.escape(m) for m in messages]
    msgs_json = _json.dumps(escaped)
    first_msg = escaped[0] if escaped else ""

    _cycle_script = (
        "<script>(function(){"
        "if(window.__nnaiMsgInterval)clearInterval(window.__nnaiMsgInterval);"
        "var msgs=" + msgs_json + ";"
        "var mi=0;"
        "window.__nnaiMsgInterval=setInterval(function(){"
        "mi=(mi+1)%msgs.length;"
        "var el=document.getElementById('nnai-loading-msg');"
        "if(el)el.textContent=msgs[mi];"
        "}," + str(interval_ms) + ");"
        "})();</script>"
    )

    return (
        '<div style="position:fixed;inset:0;z-index:9999;'
        'background:rgba(18,20,35,0.52);backdrop-filter:blur(7px);'
        'display:flex;align-items:center;justify-content:center;'
        'flex-direction:column;gap:12px;">'
        '<canvas id="nnai-globe-canvas" width="88" height="108" '
        'style="display:block;image-rendering:pixelated;'
        'image-rendering:crisp-edges;"></canvas>'
        '<p id="nnai-loading-msg" '
        'style="color:rgba(255,255,255,0.75);font-size:0.85rem;'
        'font-family:Inter,sans-serif;margin:0;text-align:center;">'
        + first_msg
        + '</p>'
        + _ANIM_SCRIPT
        + _cycle_script
        + '</div>'
    )


def get_loading_html(message: str) -> str:
    """Return a self-contained full-screen loading overlay HTML string.

    The overlay is position:fixed covering the full viewport. It contains:
    - An 88x108px canvas rendering a pixel-art Earth globe (CCW rotation)
      with a ㅅ-shaped walking character on top
    - A text label showing *message*
    - An inline <script> starting the requestAnimationFrame loop

    Each call cancels any existing RAF loop (window.__nnaiRAF) before starting
    a new one, so yielding multiple loading messages in sequence is safe.

    Clearing: yield LOADING_CLEAR ("") to the gr.HTML component. Gradio sets
    innerHTML to empty, detaching the canvas; the loop's isConnected check
    then exits the loop automatically.
    """
    return (
        '<div style="position:fixed;inset:0;z-index:9999;'
        'background:rgba(18,20,35,0.52);backdrop-filter:blur(7px);'
        'display:flex;align-items:center;justify-content:center;'
        'flex-direction:column;gap:12px;">'
        '<canvas id="nnai-globe-canvas" width="88" height="108" '
        'style="display:block;image-rendering:pixelated;'
        'image-rendering:crisp-edges;"></canvas>'
        '<p style="color:rgba(255,255,255,0.75);font-size:0.85rem;'
        'font-family:Inter,sans-serif;margin:0;text-align:center;">'
        + _html.escape(message)
        + '</p>'
        + _ANIM_SCRIPT
        + '</div>'
    )


# Header globe — small always-on pixel-art Earth.
# HEADER_GLOBE_HTML : canvas + h1 title (static value for gr.HTML)
# HEADER_GLOBE_HEAD : <script> passed via gr.HTML(head=...) so Gradio
#                     executes it properly through its loadHead() mechanism.
# Canvas: 48x48px, radius: 22px, pixel size: 3px.
HEADER_GLOBE_HTML = (
    '<h1 style="display:flex;align-items:center;justify-content:center;'
    'font-size:2rem;color:var(--nn-title,#0C447C);margin:0 0 4px;">'
    '<canvas id="nnai-hdr-globe" width="48" height="48"'
    ' style="display:inline-block;vertical-align:middle;'
    'image-rendering:pixelated;image-rendering:crisp-edges;'
    'margin-right:10px;"></canvas>'
    'NomadNavigator AI</h1>'
)

HEADER_GLOBE_JS = """(function(){
if(window.__nnaiHdrRAF)cancelAnimationFrame(window.__nnaiHdrRAF);
var W=[
  [0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [1,1,0,0,0,0,0,0,0,0,1,1,1,0,1,1,1,1,1,1,1,1,0,0],
  [1,1,0,1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,0,0,0,1,1,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,0,0,1,0,0,0,1,1,1,1,1,0,1,1,1,1,0,0,0],
  [0,0,0,0,0,0,0,0,1,1,1,0,0,1,1,1,0,0,0,1,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,0,0,0,1,0,0,0,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
var MC=24,MR=12,PS=3;
var LAND=['#1B5E20','#2E7D32','#43A047','#66BB6A'];
var OCEAN=['#0A1F6B','#0D47A1','#1565C0','#1E88E5'];
var ICE=['#B0C4DE','#D6EAF8','#EBF5FB'];
function sh(p,l){return p[Math.min(p.length-1,Math.floor(l*p.length))];}
function drawGlobe(ctx,cx,cy,r,ang){
  for(var py=-r;py<r;py+=PS){
    for(var px=-r;px<r;px+=PS){
      var pc=px+PS/2,pcy=py+PS/2,d2=pc*pc+pcy*pcy;
      if(d2>r*r)continue;
      var z=Math.sqrt(r*r-d2);
      var lat=Math.asin(-pcy/r);
      var lon=((Math.atan2(pc,z)-ang)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
      var mc=Math.floor(lon/(2*Math.PI)*MC)%MC;
      var mr=Math.max(0,Math.min(MR-1,Math.floor((Math.PI/2-lat)/Math.PI*MR)));
      var light=z/r;
      var col;
      if(W[mr][mc]===1)col=sh(LAND,light);
      else col=sh(OCEAN,light);
      ctx.fillStyle=col;
      ctx.fillRect(Math.round(cx+px),Math.round(cy+py),PS,PS);
    }
  }
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.strokeStyle='rgba(120,190,255,0.5)';ctx.lineWidth=1;ctx.stroke();
}
var angle=0;
function loop(){
  var canvas=document.getElementById('nnai-hdr-globe');
  if(!canvas||!canvas.isConnected){
    /* Intentional: keep retrying on temporary detach caused by Gradio re-renders.
       The header globe is always present for the page lifetime, so this loop
       never intentionally exits. Permanent removal would require a page reload. */
    window.__nnaiHdrRAF=requestAnimationFrame(loop);
    return;
  }
  var ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,48,48);
  angle-=0.014;
  drawGlobe(ctx,24,24,22,angle);
  window.__nnaiHdrRAF=requestAnimationFrame(loop);
}
window.__nnaiHdrRAF=requestAnimationFrame(loop);
})();"""
