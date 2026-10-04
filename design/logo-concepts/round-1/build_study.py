palettes = {
  "A · Shoreline": dict(p="#1F4E5A", l="#EFE4CF", a="#E8875B", d="#12323A", bg="#F8F3EA"),
  "B · Dusk":      dict(p="#24395C", l="#FBF3E6", a="#F2A65A", d="#16243D", bg="#FBF7F0"),
  "C · Sage":      dict(p="#5E7F6B", l="#F3EEE1", a="#E3B55B", d="#34493C", bg="#F6F3EA"),
}
def peek(c, tile=True, s=1.35, ty=180.4, bgfill=None):
    bgfill = bgfill or c["p"]
    t = f'<rect width="256" height="256" rx="56" fill="{c["p"]}"/>' if tile else ''
    return f'''<svg viewBox="0 0 256 256">{'<clipPath id="ct"><rect width="256" height="256" rx="56"/></clipPath>' if tile else ''}{t}
<g {'clip-path="url(#ct)"' if tile else ''}><g transform="translate(128 {ty}) scale({s}) translate(-128 -152)">
<path fill="{c["l"]}" d="M43.3 208 A88 88 0 1 1 212.7 208 Z"/>
<circle cx="98" cy="150" r="11" fill="{c["d"]}"/><circle cx="158" cy="150" r="11" fill="{c["d"]}"/>
<path d="M117 167 H139 L128 182 Z" fill="{c["a"]}" stroke="{c["a"]}" stroke-width="5" stroke-linejoin="round"/>
<ellipse cx="74" cy="208" rx="30" ry="26" fill="{bgfill}"/><ellipse cx="182" cy="208" rx="30" ry="26" fill="{bgfill}"/>
<path fill="{c["l"]}" d="M51 208 A23 19 0 0 1 97 208 Z"/><path fill="{c["l"]}" d="M159 208 A23 19 0 0 1 205 208 Z"/>
</g></g></svg>'''
def pebble(c, tile=True):
    t = f'<rect width="256" height="256" rx="56" fill="{c["l"]}"/>' if tile else ''
    g = f'''<g transform="translate(128 132) scale({0.98 if tile else 1}) translate(-138 -128)">
<circle cx="122" cy="154" r="72" fill="{c["p"]}"/>
<circle cx="150" cy="86" r="80" fill="none" stroke="{c["d"]}" stroke-width="16" clip-path="url(#cb)"/>
<circle cx="150" cy="86" r="88" fill="none" stroke="{c["l"] if tile else '#fff'}" stroke-width="0"/>
<circle cx="150" cy="86" r="56" fill="{c["l"] if tile else '#fff'}"/>
<circle cx="150" cy="86" r="48" fill="{c["p"]}"/>
<circle cx="162" cy="78" r="8.5" fill="{c["l"]}"/>
<path d="M192 70 L226 84 L192 98 Z" fill="{c["a"]}" stroke="{c["a"]}" stroke-width="4" stroke-linejoin="round"/></g>'''
    return f'<svg viewBox="0 0 256 256"><defs><clipPath id="cb"><circle cx="122" cy="154" r="72"/></clipPath></defs>{t}{g}</svg>'
def pmono(c, tile=True):
    t = f'<rect width="256" height="256" rx="56" fill="{c["p"]}"/>' if tile else ''
    f = c["l"] if tile else c["p"]
    eye = c["p"] if tile else '#fff'
    return f'''<svg viewBox="0 0 256 256">{t}<g transform="translate(128 132) scale({0.78 if tile else 1}) translate(-160 -133)">
<circle cx="148" cy="106" r="72" fill="{f}"/><path fill="{f}" d="M76 52 A18 18 0 0 1 94 34 H148 V178 H76 Z"/>
<rect x="84" y="166" width="16" height="66" rx="8" fill="{f}"/><rect x="84" y="220" width="40" height="13" rx="6.5" fill="{f}"/>
<circle cx="168" cy="94" r="22" fill="{eye}"/>
<path d="M214 78 L244 94 L213 110 Z" fill="{c["a"]}" stroke="{c["a"]}" stroke-width="4" stroke-linejoin="round"/></g></svg>'''
fonts = [("Warm humanist · Manrope 700", "'Manrope'", 700, "-0.02em", ""),
         ("Rounded geometric · Quicksand 700", "'Quicksand'", 700, "-0.01em", ""),
         ("Soft serif · Fraunces SOFT 100", "'Fraunces'", 600, "-0.01em", "font-variation-settings:'SOFT' 100,'WONK' 0;")]
ink = dict(p="#1d1d1f", l="#ffffff", a="#1d1d1f", d="#1d1d1f", bg="#fff")
sym = {"Peek": peek, "Pebble": pebble, "p-bird": pmono}

h = ['''<!doctype html><html><head><meta charset="utf-8"><title>Plover logo study</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@700&family=Quicksand:wght@700&family=Fraunces:opsz,wght,SOFT,WONK@9..144,600,100,0&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>body{margin:0;background:#fff;font-family:Inter,sans-serif;color:#222;width:1400px}
section{padding:36px 48px;border-bottom:1px solid #eee}h2{font-size:20px;margin:0 0 4px}p.n{color:#777;margin:0 0 20px;font-size:13px}
.row{display:flex;gap:40px;align-items:center;flex-wrap:wrap}.ic{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:12px;color:#666}
.ic svg.big{width:150px;height:150px}.sm{display:flex;gap:10px;align-items:end}.sm svg{display:block}
.lock{display:flex;align-items:center;gap:14px}.lock svg{width:64px;height:64px}.wm{font-size:58px;line-height:1}
.grid{display:grid;grid-template-columns:330px 1fr 1fr;gap:18px 30px;align-items:center}.lbl{font-size:13px;color:#555}
.sw{display:flex;gap:8px}.sw div{width:70px;height:46px;border-radius:8px;font-size:10px;display:flex;align-items:end;padding:4px;box-sizing:border-box}
</style></head><body>''']
h.append('<section><h2>Font directions</h2><p class="n">Live web fonts, for exploration only. The final wordmark will be custom-drawn outlines.</p><div class="grid">')
for name, fam, w, ls, extra in fonts:
    h.append(f'<div class="lbl">{name}</div>')
    for word in ("Plover", "plover"):
        h.append(f'<div class="lock">{pmono(ink, tile=False)}<span class="wm" style="font-family:{fam};font-weight:{w};letter-spacing:{ls};{extra}">{word}</span></div>')
h.append('</div></section>')
for pname, c in palettes.items():
    h.append(f'<section style="background:{c["bg"]}"><h2>Colour {pname}</h2><div class="sw" style="margin:10px 0 22px">')
    for k, lab in (("p","primary"),("d","ink"),("l","light"),("a","accent")):
        txt = "#fff" if k in "pd" else "#333"
        h.append(f'<div style="background:{c[k]};color:{txt};border:1px solid #0001">{lab}<br>{c[k]}</div>')
    h.append('</div><div class="row">')
    for sn, fn in sym.items():
        s = fn(c)
        h.append(f'<div class="ic"><svg class="big" viewBox="0 0 256 256">{s[s.index(">")+1:]}<div class="sm">'
                 + "".join(f'<svg width="{z}" height="{z}" viewBox="0 0 256 256">{s[s.index(">")+1:]}' for z in (48,32,16))
                 + f'</div>{sn}</div>')
    h.append('</div><div class="row" style="margin-top:30px;gap:60px">')
    for (fname, fam, w, ls, extra), word, fn in zip(fonts, ("Plover","plover","Plover"), (pmono, pebble, peek)):
        mark = fn(c, tile=True)
        h.append(f'<div class="lock">{mark}<span class="wm" style="font-size:48px;color:{c["d"]};font-family:{fam};font-weight:{w};letter-spacing:{ls};{extra}">{word}</span></div>')
    h.append('</div></section>')
h.append('</body></html>')
open("logo-study.html","w",encoding="utf-8").write("\n".join(h))
