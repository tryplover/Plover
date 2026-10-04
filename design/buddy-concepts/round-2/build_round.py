P = "#5E7F6B"; L = "#F3EEE1"; W = "#D9CFB4"; D = "#2F4236"; A = "#E3B55B"; BG = "#F6F3EA"
CX, CY, R = 128, 142, 100
n = [0]


def uid():
    n[0] += 1
    return f"r{n[0]}"


def eye_set(kind, y=124, turn=False):
    o = ""
    for x in ((80, 144) if turn else (94, 160)):
        k = .8 if (turn and x == 80) else 1
        o += f'<g transform="translate({x} {y}) scale({k} 1) translate({-x} {-y})">'
        if kind == "arc":
            o += f'<path d="M{x-11} {y-4} Q{x} {y+8} {x+11} {y-4}" fill="none" stroke="{D}" stroke-width="7" stroke-linecap="round"/>'
        if kind == "happy":
            o += f'<path d="M{x-11} {y+4} Q{x} {y-9} {x+11} {y+4}" fill="none" stroke="{D}" stroke-width="7" stroke-linecap="round"/>'
        if kind == "pill":
            o += f'<rect x="{x-6.5}" y="{y-13}" width="13" height="23" rx="6.5" fill="{D}"/>'
        o += '</g>'
    return o


def wing(side):
    if side == "l":
        d = "M28 200 C20 174 22 150 36 126 C52 144 62 170 62 198 Q46 212 28 200 Z"
        o = "46px 202px"
    else:
        d = "M228 200 C236 174 234 150 220 126 C204 144 194 170 194 198 Q210 212 228 200 Z"
        o = "210px 202px"
    return (f'<path class="wing w{side}" style="transform-origin:{o}" d="{d}" fill="{W}" '
            f'stroke="#C9BD9F" stroke-width="3" stroke-linejoin="round"/>')


def bird(feet=True, cap=True, turn=True):
    j = uid()
    capd = (f'<path clip-path="url(#{j})" d="{'M0 0 H256 V70 Q96 88 0 54 Z' if turn else 'M0 0 H256 V62 Q128 84 0 62 Z'}" fill="{W}"/>' if cap else "")
    ft = (f'<ellipse cx="108" cy="244" rx="11" ry="6" fill="{A}"/>'
          f'<ellipse cx="148" cy="244" rx="11" ry="6" fill="{A}"/>') if feet else ""
    dots = "".join(f'<circle cx="{x}" cy="30" r="6" fill="{P}" opacity="{o}"/>'
                   for x, o in ((180, .45), (200, .7), (220, 1)))
    return f'''<svg class="bird" viewBox="0 0 256 280" xmlns="http://www.w3.org/2000/svg">
<defs><clipPath id="{j}"><circle cx="{CX}" cy="{CY}" r="{R}"/></clipPath></defs>
<ellipse class="shadow" cx="128" cy="256" rx="70" ry="9" fill="{D}" opacity=".12"/>
<g class="extras">
  <g class="x-z"><path d="M196 34 H218 L196 60 H218" fill="none" stroke="{P}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>
  <g class="x-dots">{dots}</g>
  <g class="x-spark"><path d="M214 22 L219 36 L233 41 L219 46 L214 60 L209 46 L195 41 L209 36 Z" fill="{A}"/><path d="M40 40 L43 48 L51 51 L43 54 L40 62 L37 54 L29 51 L37 48 Z" fill="{A}"/></g>
</g>
<g class="body">
  {ft}
  <g class="headg">
    <circle cx="{CX}" cy="{CY}" r="{R}" fill="{L}"/>
    {capd}
    <circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="#DCD2BB" stroke-width="4"/>
    <g class="face">
      <g class="e-pill">{eye_set("pill", turn=turn)}</g><g class="e-arc">{eye_set("arc", turn=turn)}</g><g class="e-happy">{eye_set("happy", turn=turn)}</g>
      <path d="{'M96 146 H130 L106 171 Z' if turn else 'M112 146 H146 L128 172 Z'}" fill="{A}" stroke="{A}" stroke-width="8" stroke-linejoin="round"/>
    </g>
  </g>
  {wing("l")}{wing("r")}
</g>
</svg>'''


STATES = [
    ("idle", "Nothing running. Eyes softly closed, slow breathing."),
    ("working", "Timer running. Eyes open, slow blink, a glance toward your work now and then."),
    ("focus", "Focus mode. Shrinks a little, settles, eyes closed. No chatter."),
    ("break", "Break. Head tips, dozes, a drifting z."),
    ("nudging", "Gentle check-in: lifts a wing and waves, three waiting dots."),
    ("celebrating", "Step done: little hop, both wings up, happy eyes, sparkle."),
]

CSS = f"""
*{{box-sizing:border-box}} body{{margin:0;background:{BG};font-family:Inter,system-ui,sans-serif;color:{D};width:1400px}}
section{{padding:30px 48px}} h1{{font-size:26px;margin:0 0 8px}}
h2{{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:{P};margin:0 0 16px}}
p.n{{max-width:900px;line-height:1.55;margin:0;color:#3d4f43}}
.bird{{display:block;overflow:visible}}
.e-arc,.e-happy,.e-pill,.extras>g{{opacity:0;transition:opacity .4s}}
.body,.headg,.face,.wing,.e-pill{{transform-box:view-box}}
.body{{transform-origin:128px 250px}} .headg{{transform-origin:128px 142px;transition:transform .8s ease}}
.face{{transition:transform .8s ease}} .e-pill{{transform-origin:128px 122px}}
.wing{{transition:transform .6s cubic-bezier(.3,.7,.3,1)}}
[data-s] .body{{animation:breathe 4.5s ease-in-out infinite}}
@keyframes breathe{{50%{{transform:scale(1.02,1.015)}}}}
[data-s=idle] .e-arc{{opacity:1}}
[data-s=working] .e-pill{{opacity:1;animation:blink 5s infinite}}
[data-s=working] .face{{animation:glance 9s ease-in-out infinite}}
@keyframes blink{{0%,92%,100%{{transform:scaleY(1)}}95%{{transform:scaleY(.1)}}}}
@keyframes glance{{0%,40%,100%{{transform:translateX(0)}}50%,70%{{transform:translateX(-7px)}}}}
[data-s=focus] .e-arc{{opacity:1}} [data-s=focus] .body{{animation:none;transform:scale(.86)}}
[data-s=focus] .wing{{transform:translateY(8px)}}
[data-s=break] .e-arc{{opacity:1}} [data-s=break] .headg{{transform:rotate(-9deg)}}
[data-s=break] .x-z{{opacity:1;animation:zz 3s ease-in-out infinite}}
@keyframes zz{{0%{{transform:translate(0,8px);opacity:0}}30%,70%{{opacity:1}}100%{{transform:translate(8px,-10px);opacity:0}}}}
[data-s=nudging] .e-pill{{opacity:1}} [data-s=nudging] .x-dots{{opacity:1}}
[data-s=nudging] .headg{{transform:rotate(6deg)}}
[data-s=nudging] .wr{{animation:wave 1.6s ease-in-out infinite}}
@keyframes wave{{0%,100%{{transform:rotate(0)}}40%{{transform:rotate(38deg)}}70%{{transform:rotate(22deg)}}}}
[data-s=celebrating] .e-happy{{opacity:1}} [data-s=celebrating] .x-spark{{opacity:1}}
[data-s=celebrating] .wl{{transform:rotate(-30deg)}} [data-s=celebrating] .wr{{transform:rotate(30deg)}}
[data-s=celebrating] .body{{animation:hop 1.4s cubic-bezier(.3,.6,.3,1) infinite}}
@keyframes hop{{0%,100%{{transform:translateY(0) scale(1)}}12%{{transform:translateY(0) scale(1.06,.94)}}40%{{transform:translateY(-22px) scale(.98,1.03)}}70%{{transform:translateY(0) scale(1)}}}}
@media (prefers-reduced-motion:reduce){{*{{animation:none!important}}}}
.desk{{position:relative;width:1100px;height:690px;border-radius:16px;background:#DCE3DA;overflow:hidden;border:1px solid #0001}}
.win{{position:absolute;background:#FBF9F3;border-radius:12px;box-shadow:0 8px 30px #0001;border:1px solid #0000000d}}
.win .bar{{height:32px;border-bottom:1px solid #0000000d;background:#F3EFE4;border-radius:12px 12px 0 0}}
.line{{height:10px;border-radius:5px;background:#E4E0D3;margin:14px 34px}}
.task{{position:absolute;left:0;right:0;bottom:0;height:48px;background:#F6F3EA;border-top:1px solid #0000000d}}
.buddy{{position:absolute;right:26px;bottom:40px;width:128px}}
.pill{{position:absolute;right:164px;bottom:60px;background:{P};color:{L};font-weight:600;font-size:14px;padding:7px 14px;border-radius:999px;display:flex;gap:8px;align-items:center}}
.pill i{{width:7px;height:7px;border-radius:50%;background:{A}}}
.btns{{display:flex;gap:8px;margin-top:14px}}
.btns button{{font:inherit;font-size:13px;border:1px solid #0002;background:#fff;border-radius:999px;padding:6px 12px;cursor:pointer}}
.btns button.on{{background:{P};color:{L};border-color:{P}}}
.grid{{display:grid;grid-template-columns:repeat(6,1fr);gap:18px}} .cell{{background:#FBF9F3;border-radius:14px;padding:16px 14px}}
.cell .bird{{width:150px;margin:0 auto}} .cell b{{display:block;margin-top:6px}} .cell span{{font-size:12.5px;color:#5b6b60;line-height:1.45}}
.vars{{display:flex;gap:40px;align-items:end}} .vars>div{{text-align:center;font-size:13px;color:#5b6b60}} .vars .bird{{width:170px}}
.sizes{{display:flex;gap:26px;align-items:end}} .sizes>div{{text-align:center;font-size:12px;color:#5b6b60}}
"""

lines1 = "".join(f'<div class="line" style="width:{w}%"></div>' for w in (40, 85, 90, 70, 88, 60, 0, 86, 80, 91, 55))
lines2 = "".join(f'<div class="line" style="width:{w}%"></div>' for w in (60, 80, 50, 70))
buttons = "".join(f'<button data-k="{k}"{" class=on" if k == "working" else ""}>{k}</button>' for k, _ in STATES)

h = [f'<!doctype html><html><head><meta charset="utf-8"><title>Round buddy</title>'
     f'<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">'
     f'<style>{CSS}</style></head><body>']
h.append('<section><h1>Round buddy: corner sitter</h1><p class="n">The round peek bird, whole: one ball (head and body '
         'are the same circle), a short sand cap, amber beak, calm eyes, and the feather-tip wings pointing <b>up</b> at its '
         'sides so it can use them: wave, cheer, tuck. Tiny feet so it sits on the taskbar edge. No collar, no extra body '
         'parts. Motion stays small: breathing, blinks, a glance, a wave, a hop.</p></section>')
h.append('<section><h2>Desktop mockup (live, click a state)</h2><div class="desk">'
         f'<div class="win" style="left:70px;top:50px;width:600px;height:500px"><div class="bar"></div>{lines1}</div>'
         f'<div class="win" style="left:720px;top:80px;width:320px;height:260px"><div class="bar"></div>{lines2}</div>'
         '<div class="task"></div><div class="pill" id="pill"><i></i><span>Draft the intro · 18:42</span></div>'
         f'<div class="buddy" id="desk" data-s="working">{bird()}</div></div><div class="btns" id="btns">{buttons}</div></section>')
h.append('<section><h2>States (engineering names)</h2><div class="grid">')
for k, desc in STATES:
    h.append(f'<div class="cell"><div data-s="{k}">{bird()}</div><b>{k}</b><span>{desc}</span></div>')
h.append('</div></section>')
h.append('<section><h2>Head turn vs. straight</h2><div class="vars">'
         f'<div><div data-s="idle">{bird()}</div>Turned · idle</div>'
         f'<div><div data-s="working">{bird()}</div>Turned · working</div>'
         f'<div><div data-s="working">{bird(turn=False)}</div>Straight · working (before)</div>'
         f'<div><div data-s="idle">{bird(turn=False)}</div>Straight · idle (before)</div>'
         '</div></section>')
h.append('<section><h2>Real desktop sizes</h2><div class="sizes">'
         + "".join(f'<div><div data-s="working" style="width:{z}px">{bird()}</div>{z}px</div>' for z in (140, 110, 80, 56, 40))
         + '</div></section>')
h.append("""<script>
const desk=document.getElementById('desk'),pill=document.querySelector('#pill span');
const txt={idle:'Ready when you are',working:'Draft the intro · 18:42',focus:'Focus · 24:10',break:'Break · 4:58',nudging:'Still on the intro?',celebrating:'+1 step done'};
document.querySelectorAll('#btns button').forEach(b=>b.onclick=()=>{desk.dataset.s=b.dataset.k;pill.textContent=txt[b.dataset.k];
document.querySelectorAll('#btns button').forEach(x=>x.classList.toggle('on',x===b));});
</script></body></html>""")
open("round-buddy.html", "w", encoding="utf-8").write("\n".join(h))
