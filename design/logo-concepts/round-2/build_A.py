P=dict(p="#5E7F6B",l="#F3EEE1",a="#E3B55B",d="#2F4236",w="#D9CFB4",bg="#F6F3EA")
n=[0]
def bird(pose=None, anim=False, size=None):
    n[0]+=1; k=f"c{n[0]}"
    q=pose or {}
    dx=q.get("dx",0); dy=q.get("dy",0); rot=q.get("rot",0); eye=q.get("eye","closed"); beak=q.get("beak",0); wing=q.get("wing",0)
    cls=lambda c: f' class="{c}"' if anim else ''
    op=lambda e: (' style="opacity:%d"'%(1 if eye==e else 0)) if not anim else ''
    hs=f' style="transform:translate({dx}px,{dy}px) rotate({rot}deg);transform-origin:168px 226px"' if not anim else ''
    bs=f' style="transform:rotate({-beak}deg);transform-origin:66px 198px"' if not anim else ''
    ws=f' style="transform:rotate({wing}deg);transform-origin:164px 262px"' if not anim else ''
    sz=f' width="{size}" height="{size}"' if size else ''
    s=f'<svg viewBox="0 0 256 256"{sz} role="img" aria-label="Plover side peek"><defs><clipPath id="{k}"><rect width="256" height="256" rx="56"/></clipPath></defs>'
    s+=f'<rect width="256" height="256" rx="56" fill="{P["p"]}"/><g clip-path="url(#{k})">'
    s+=f'<g{cls("head")}{hs}><g{cls("breath")}><circle cx="168" cy="226" r="112" fill="{P["l"]}"/>'
    s+=f'<path{cls("eC")}{op("closed")} d="M108 168 Q122 182 136 168" fill="none" stroke="{P["d"]}" stroke-width="8" stroke-linecap="round"/>'
    s+=f'<circle{cls("eO")}{op("open")} cx="122" cy="171" r="8" fill="{P["d"]}"/>'
    s+=f'<path{cls("eH")}{op("happy")} d="M108 178 Q122 160 136 178" fill="none" stroke="{P["d"]}" stroke-width="8" stroke-linecap="round"/>'
    a=P["a"]
    s+=f'<path d="M66 178 Q40 186 22 196 L68 195 Z" fill="{a}" stroke="{a}" stroke-width="8" stroke-linejoin="round"/>'
    s+=f'<g{cls("jaw")}{bs}><path d="M22 196 Q42 206 68 212 L68 195 Z" fill="{a}" stroke="{a}" stroke-width="8" stroke-linejoin="round"/></g>'
    s+=f'<g{cls("wing")}{ws}><path d="M138 260 C138 236 152 222 164 210 C176 222 190 236 190 260 Z" fill="{P["w"]}" stroke="{P["l"]}" stroke-width="5" stroke-linejoin="round"/></g>'
    s+='</g></g></g></svg>'
    return s

poses=[
 ("Idle","resting at the edge, calm",dict(eye="closed")),
 ("Focus started","eyes open, leans in to watch",dict(eye="open",dx=-7,dy=-8,rot=-3)),
 ("Check-in","chirps: how is it going?",dict(eye="open",dx=-3,dy=-4,rot=-5,beak=9)),
 ("Break time","eases back, eyes shut",dict(eye="closed",dx=6,dy=10,rot=5)),
 ("Nice work","happy eye, wing up",dict(eye="happy",dy=-9,beak=6,wing=-22)),
 ("Away","ducks out of sight",dict(eye="closed",dx=22,dy=118)),
]
sb="".join(f'<figure><div class="tile">{bird(p)}</div><figcaption><b>{a}</b><span>{b}</span></figcaption></figure>' for a,b,p in poses)

CSS='''
:root{--p:#5E7F6B;--l:#F3EEE1;--a:#E3B55B;--d:#2F4236;--w:#D9CFB4;--bg:#F6F3EA}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--d);font-family:Inter,system-ui,sans-serif;padding:40px 48px;width:1300px}
h1{font-size:24px;margin:0 0 6px}h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--p);margin:36px 0 14px}
p.r{max-width:860px;line-height:1.55;font-size:15px;margin:0}
.top{display:flex;gap:56px;align-items:flex-end}
.col{display:flex;flex-direction:column;gap:8px;align-items:center;font-size:12px;color:#5b6b60}
.sizes{display:flex;gap:22px;align-items:flex-end}
.anim{display:flex;gap:40px;align-items:center}
.note{font-size:13px;line-height:1.6;max-width:520px;color:#4a5a4f}
.sb{display:flex;gap:16px}figure{margin:0;width:180px}
.tile svg{width:180px;height:180px;display:block}
figcaption{display:flex;flex-direction:column;gap:2px;margin-top:10px;font-size:12px;color:#4a5a4f}figcaption b{font-size:14px;color:var(--d)}
.head,.breath,.eC,.eO,.eH,.jaw,.wing{transform-box:view-box}
.head{animation:head 9s infinite;transform-origin:168px 226px}
.breath{transform-origin:168px 226px;animation:br 4.5s ease-in-out infinite}
@keyframes br{0%,100%{transform:scale(1)}50%{transform:scale(1.015)}}
.eC{animation:eC 9s infinite}.eO{animation:eO 9s infinite;transform-origin:122px 171px}.eH{animation:eH 9s infinite}
.jaw{transform-origin:66px 198px;animation:jaw 9s infinite}
.wing{transform-origin:164px 262px;animation:wing 9s infinite}
@keyframes head{
 0%{transform:translate(95px,120px);animation-timing-function:cubic-bezier(.22,.8,.3,1)}
 14%{transform:translate(-4px,-6px) rotate(-.6deg);animation-timing-function:ease-in-out}
 19%{transform:translate(0,0) rotate(0);animation-timing-function:ease-in-out}
 38%{transform:translate(0,0);animation-timing-function:ease-in-out}
 43%{transform:translate(-5px,-7px) rotate(-3deg)}
 58%{transform:translate(-3px,-4px) rotate(-5deg);animation-timing-function:ease-in-out}
 62%{transform:translate(0,-9px) rotate(0)}
 75%{transform:translate(0,-9px) rotate(0);animation-timing-function:ease-in-out}
 80%{transform:translate(0,0);animation-timing-function:ease-in-out}
 86%{transform:translate(0,0);animation-timing-function:cubic-bezier(.5,0,.8,.4)}
 95%,100%{transform:translate(95px,120px)}}
@keyframes eC{0%,22%{opacity:1}23%,60%{opacity:0}61%,79%{opacity:0}80%,100%{opacity:1}}
@keyframes eO{0%,22%{opacity:0}24%,36%{opacity:1;transform:scaleY(1)}37.5%{opacity:1;transform:scaleY(.1)}39%,60%{opacity:1;transform:scaleY(1)}61%{opacity:0}80%,100%{opacity:0}}
@keyframes eH{0%,60%{opacity:0}62%,76%{opacity:1}79%,100%{opacity:0}}
@keyframes jaw{0%,46%{transform:rotate(0)}48%{transform:rotate(-9deg)}50%{transform:rotate(0)}52%{transform:rotate(-9deg)}54%{transform:rotate(0)}
 62%{transform:rotate(0)}64%{transform:rotate(-6deg)}67%{transform:rotate(0)}100%{transform:rotate(0)}}
@keyframes wing{0%,63%{transform:rotate(0)}66%{transform:rotate(-22deg)}68%{transform:rotate(-8deg)}70%{transform:rotate(-22deg)}72%{transform:rotate(-8deg)}74%{transform:rotate(-20deg)}78%,100%{transform:rotate(0)}}
@media (prefers-reduced-motion:reduce){.head,.breath,.eC,.eO,.eH,.jaw,.wing{animation:none}.eC{opacity:1}.eO,.eH{opacity:0}}
'''

html=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>A - Calm side peek, animated</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>
<h1>A &middot; Calm side peek, animated</h1>
<p class="r">The founder favourite kept essentially as drawn: a cream head rising from the bottom-right corner of the sage tile, closed content eye, long gold beak pointing left, one feather-tip wing at the base. Refinements are small: the beak is split into an upper and a lower half so it can chirp, the wing is a separate pivot so it can flutter, and the eye has three states (closed, open dot, happy arch). The loop is nine slow seconds: slide in with a tiny overshoot, breathe, wake and blink, lean in and chirp, flutter the wing for a "nice work" beat, settle, then sink away. Everything eases, nothing bounces, and the static mark stays the same as the reference.</p>
<h2>Static icon</h2>
<div class="top"><div class="col">{bird(size=220)}220 px</div>
<div class="sizes"><div class="col">{bird(size=64)}64</div><div class="col">{bird(size=32)}32</div><div class="col">{bird(size=16)}16</div></div></div>
<h2>Animated loop (9 s)</h2>
<div class="anim">{bird(anim=True,size=260)}
<div class="note"><b>Timeline.</b> 0-1.7 s slide in, overshoot, settle. 2-3.4 s eye opens, breathing continues. 3.5 s calm blink. 3.9-5.2 s leans toward you, chirps twice. 5.6-7 s happy eye and a wing flutter. 7.2-8.5 s settles, eye closes, sinks back down. Breathing (scale 1 to 1.015) runs on its own 4.5 s cycle. Honours reduced-motion by showing the static icon.</div></div>
<h2>Storyboard</h2>
<div class="sb">{sb}</div>
</body></html>'''
open("D:/GitHub/Plover/design/logo-concepts/round-2/A-side-peek.html","w",encoding="utf-8").write(html)
