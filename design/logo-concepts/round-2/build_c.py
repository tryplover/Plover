P="#5E7F6B"; L="#F3EEE1"; W="#D9CFB4"; D="#2F4236"; A="#E3B55B"; BG="#F6F3EA"
CY=232; R=104
n=[0]
def uid():
    n[0]+=1; return f"c{n[0]}"

def eyes(kind):
    xs=(90,166); o=""
    for x in xs:
        if kind=="arc": o+=f'<path d="M{x-12} 177 Q{x} 191 {x+12} 177" fill="none" stroke="{D}" stroke-width="7.5" stroke-linecap="round"/>'
        elif kind=="happy": o+=f'<path d="M{x-12} 186 Q{x} 171 {x+12} 186" fill="none" stroke="{D}" stroke-width="7.5" stroke-linecap="round"/>'
        elif kind=="pill": o+=f'<rect x="{x-7}" y="168" width="14" height="25" rx="7" fill="{D}"/>'
        elif kind=="focus": o+=f'<path d="M{x-7} 170 H{x+7} V186 a7 7 0 0 1 -14 0 Z" fill="{D}" stroke="{D}" stroke-width="2" stroke-linejoin="round"/>'
    return o

BEAK=(f'<path d="M108 197 H146 L125 228 Z" fill="{A}" stroke="{A}" stroke-width="8" stroke-linejoin="round"/>'
      f'<path d="M126 205 L125 219" stroke="{D}" stroke-width="3" stroke-linecap="round" opacity=".55"/>')

def bird(dy=0, rot=-8, sx=-9, eye="arc", wy=0, wspread=0, anim=False, extra="", beak_dy=0):
    i,j=uid(),uid()
    cls=lambda c:(f' class="{c}"' if anim else "")
    sty=lambda s:("" if anim else f' style="{s}"')
    if eye=="anim":
        e=f'<g class="eo">{eyes("pill")}</g><g class="ec">{eyes("arc")}</g>'
    else: e=eyes(eye)
    s=wspread
    wl=f'M{10-s} 262 C{12-s} 232 {26-s} 206 {62-s} 190 C{62-s} 216 {58-s} 240 {56-s} 262 Z'
    wr=f'M{246+s} 262 C{244+s} 232 {230+s} 206 {194+s} 190 C{194+s} 216 {198+s} 240 {200+s} 262 Z'
    wings="".join(f'<path d="{d}" fill="{W}" stroke="{L}" stroke-width="5" stroke-linejoin="round"/>' for d in (wl,wr))
    return (f'<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><defs>'
      f'<clipPath id="{i}"><rect width="256" height="256" rx="56"/></clipPath>'
      f'<clipPath id="{j}"><circle cx="128" cy="{CY}" r="{R}"/></clipPath></defs>'
      f'<rect width="256" height="256" rx="56" fill="{P}"/><g clip-path="url(#{i})">{extra}'
      f'<g{cls("bird")}{sty(f"transform:translateY({dy}px)")}>'
      f'<g{cls("head")}{sty(f"transform:rotate({rot}deg);transform-origin:128px {CY}px")}>'
      f'<circle cx="128" cy="{CY}" r="{R}" fill="{L}"/>'
      f'<path clip-path="url(#{j})" d="M0 0 H256 V150 Q128 172 0 150 Z" fill="{W}" opacity=".85"/>'
      f'<path clip-path="url(#{j})" d="M0 247 Q128 233 256 247 V260 Q128 246 0 260 Z" fill="{D}"/>'
      f'<g{cls("face")}{sty(f"transform:translateX({sx}px)")}>{e}<g transform="translate(0 {beak_dy})">{BEAK}</g></g></g></g>'
      f'<g{cls("wings")}{sty(f"transform:translateY({wy}px)")}>{wings}</g></g></svg>')

def sized(s,z): return s.replace("<svg ",f'<svg width="{z}" height="{z}" ',1)

sparkle=f'<path d="M206 70 L211 84 L225 89 L211 94 L206 108 L201 94 L187 89 L201 84 Z" fill="{A}"/>'
dots="".join(f'<circle cx="{x}" cy="70" r="6" fill="{L}" opacity="{o}"/>' for x,o in ((176,.5),(198,.75),(220,1)))
zz=f'<path d="M190 60 H214 L190 88 H214" fill="none" stroke="{L}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'
poses=[
 ("Idle","Resting at the edge. Content, always there.", bird(-26,-8,-9,"arc")),
 ("Focus started","Rises taller, eyes open and level. Timer is running.", bird(-40,-3,-4,"focus",wy=-2)),
 ("Check-in","Turns to you, tilts, waits. How is it going?", bird(-32,6,3,"pill",extra=dots)),
 ("Break time","Sinks low, eyes closed, head tipped. Rest.", bird(6,-14,-14,"arc",wy=2,extra=zz)),
 ("Nice work","Pops up, wings lift, happy eyes. Step done.", bird(-52,0,0,"happy",wy=-16,wspread=8,extra=sparkle)),
 ("Away / hidden","Only crown and wing tips show. Still near.", bird(84,-6,-6,"arc",wy=8)),
]

css='''
:root{--bg:#F6F3EA;--ink:#2F4236;--mut:#6a7a6f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,system-ui,sans-serif;width:1300px}
section{padding:28px 56px}h1{font-size:26px;margin:0 0 10px}h2{font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);margin:0 0 16px}
p.r{max-width:900px;line-height:1.55;font-size:15px;margin:0}
.row{display:flex;gap:44px;align-items:flex-end}.col{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:12px;color:var(--mut)}
.sm{display:flex;gap:16px;align-items:flex-end}
.sb{display:grid;grid-template-columns:repeat(6,1fr);gap:20px}.sb .c{display:flex;flex-direction:column;gap:8px}
.sb svg{width:100%;height:auto}.sb b{font-size:14px}.sb span{font-size:12px;line-height:1.4;color:var(--mut)}
.anim .head,.anim .face,.anim .bird,.anim .wings,.anim .eo,.anim .ec{animation-duration:9s;animation-iteration-count:infinite;animation-delay:-3.2s}
.anim .bird{animation-name:bird;animation-timing-function:cubic-bezier(.45,0,.35,1)}
.anim .wings{animation-name:wings;animation-timing-function:cubic-bezier(.45,0,.35,1)}
.anim .head{animation-name:head;transform-origin:128px 232px;animation-timing-function:cubic-bezier(.45,0,.35,1)}
.anim .face{animation-name:face;animation-timing-function:cubic-bezier(.45,0,.35,1)}
.anim .eo{animation-name:eo;animation-timing-function:linear}
.anim .ec{animation-name:ec;animation-timing-function:linear}
@keyframes bird{0%,4%{transform:translateY(140px)}24%{transform:translateY(-26px)}
 68%{transform:translateY(-26px)}70.5%{transform:translateY(-32px)}73%{transform:translateY(-26px)}75.5%{transform:translateY(-32px)}78%{transform:translateY(-26px)}
 86%{transform:translateY(-26px)}97%,100%{transform:translateY(140px)}}
@keyframes wings{0%,8%{transform:translateY(140px)}27%{transform:translateY(0)}29%{transform:translateY(4px)}32%{transform:translateY(0)}
 86%{transform:translateY(0)}97%,100%{transform:translateY(140px)}}
@keyframes head{0%,24%{transform:rotate(-8deg)}33%{transform:rotate(-17deg)}41%{transform:rotate(-17deg)}50%{transform:rotate(9deg)}57%{transform:rotate(9deg)}65%{transform:rotate(-8deg)}100%{transform:rotate(-8deg)}}
@keyframes face{0%,24%{transform:translateX(-9px)}33%{transform:translateX(-14px)}41%{transform:translateX(-14px)}50%{transform:translateX(8px)}57%{transform:translateX(8px)}65%{transform:translateX(-9px)}100%{transform:translateX(-9px)}}
@keyframes eo{0%,28%{opacity:0}30%{opacity:1}60%{opacity:1}60.6%{opacity:0}62.4%{opacity:0}63%{opacity:1}67%{opacity:1}69%,100%{opacity:0}}
@keyframes ec{0%,28%{opacity:1}30%{opacity:0}60%{opacity:0}60.6%{opacity:1}62.4%{opacity:1}63%{opacity:0}67%{opacity:0}69%,100%{opacity:1}}
@media (prefers-reduced-motion:reduce){.anim *{animation:none!important}}
'''
hero=bird()
anim=bird(anim=True,eye="anim")
cards="".join(f'<div class="c">{svg}<b>{nm}</b><span>{d}</span></div>' for nm,d,svg in poses)
html=f'''<!doctype html><html><head><meta charset="utf-8"><title>C Front peek</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>{css}</style></head><body>
<section><h1>C - Front peek, unmistakably a bird</h1>
<p class="r">A front-facing head rises over the bottom edge, but turned about 8 degrees so the beak is a short wedge seen from slightly above and pointing a little left, echoing the side-peek beak. Three plover cues do the species work: a soft sand-toned forehead cap, a dark collar band hugging the edge, and pointed feather-tip wings gripping the edge (no flippers, no chick fluff). Eyes are calm closed arcs at rest and soft pills when alert. The loop is 9 s: rise, wings grip, look left, look right, calm blink, little head bob, sink.</p></section>
<section><h2>Static icon</h2><div class="row"><div class="col">{sized(hero,220)}220</div>
<div class="sm"><div class="col">{sized(hero,64)}64</div><div class="col">{sized(hero,32)}32</div><div class="col">{sized(hero,16)}16</div></div></div></section>
<section><h2>Animated loop (9 s)</h2><div class="anim">{sized(anim,260)}</div></section>
<section><h2>Storyboard</h2><div class="sb">{cards}</div></section>
</body></html>'''
open("C-front-peek.html","w",encoding="utf-8").write(html)
