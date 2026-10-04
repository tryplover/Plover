pal = {
  "Shoreline": dict(p="#1F4E5A", l="#EFE4CF", a="#E8875B", d="#12323A", w="#D8C3A0", bg="#F8F3EA"),
  "Sage":      dict(p="#5E7F6B", l="#F3EEE1", a="#E3B55B", d="#2F4236", w="#D9CFB4", bg="#F6F3EA"),
}
n = [0]
def uid():
    n[0] += 1; return f"k{n[0]}"

HEAD = '<circle cx="128" cy="236" r="124" fill="{l}"/>'
def wings_round(c):
    return "".join(f'<path d="M{x-27} 256 A27 24 0 0 1 {x+27} 256 Z" fill="{c["l"]}" stroke="{c["p"]}" stroke-width="8"/>' for x in (66,190))
def wings_feather(c, xs=(66,190)):
    return "".join(f'<path d="M{x-26} 260 C{x-26} 236 {x-12} 222 {x} 210 C{x+12} 222 {x+26} 236 {x+26} 260 Z" fill="{c["w"]}" stroke="{c["l"]}" stroke-width="5" stroke-linejoin="round"/>' for x in xs)
def beak(c, y=206, tip=False):
    b = f'<path d="M115 {y} H141 L128 {y+18} Z" fill="{c["a"]}" stroke="{c["a"]}" stroke-width="6" stroke-linejoin="round"/>'
    if tip:
        b += f'<path d="M122.5 {y+11} H133.5 L128 {y+18} Z" fill="{c["d"]}" stroke="{c["d"]}" stroke-width="6" stroke-linejoin="round"/>'
    return b
def pills(c, y=180, fill=None):
    f = fill or c["d"]
    return "".join(f'<rect x="{x-7.5}" y="{y}" width="15" height="28" rx="7.5" fill="{f}"/>' for x in (92,164))
def dots(c, y=192, r=11, fill=None):
    f = fill or c["d"]
    return "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{f}"/>' for x in (92,164))
def blink(c, y=190):
    return "".join(f'<path d="M{x-13} {y} Q{x} {y+14} {x+13} {y}" fill="none" stroke="{c["d"]}" stroke-width="8" stroke-linecap="round"/>' for x in (92,164))
def tile(c, inner):
    i = uid()
    return (f'<svg viewBox="0 0 256 256"><defs><clipPath id="{i}"><rect width="256" height="256" rx="56"/></clipPath></defs>'
            f'<rect width="256" height="256" rx="56" fill="{c["p"]}"/><g clip-path="url(#{i})">{inner}</g></svg>')

def v1(c):
    return tile(c, HEAD.format(**c) + pills(c, 160) + beak(c, 196) + wings_feather(c))
def v2(c):
    return tile(c, HEAD.format(**c) + blink(c, 172) + beak(c, 192) + wings_feather(c))
def v3(c):
    j = uid()
    inner = (f'<defs><clipPath id="{j}"><circle cx="128" cy="236" r="124"/></clipPath></defs>' + HEAD.format(**c)
             + f'<path clip-path="url(#{j})" d="M0 134 Q128 120 256 134 V150 Q128 138 0 150 Z" fill="{c["d"]}"/>'
             + pills(c, 162) + beak(c, 198, tip=True) + wings_feather(c))
    return tile(c, inner)
def side(c, eye):
    return tile(c, f'<circle cx="168" cy="226" r="112" fill="{c["l"]}"/>' + eye
             + f'<path d="M66 178 L22 196 L68 212 Z" fill="{c["a"]}" stroke="{c["a"]}" stroke-width="8" stroke-linejoin="round"/>'
             + wings_feather(c, (164,)))
def v4(c):
    return side(c, f'<rect x="114" y="152" width="16" height="30" rx="8" fill="{c["d"]}"/>')
def v5(c):
    return side(c, f'<path d="M108 168 Q122 182 136 168" fill="none" stroke="{c["d"]}" stroke-width="8" stroke-linecap="round"/>')

def v6(c):  # full calm face, not peeking
    inner = (f'<path d="M128 46 C200 46 222 104 222 150 C222 206 182 230 128 230 C74 230 34 206 34 150 C34 104 56 46 128 46 Z" fill="{c["l"]}"/>'
             + pills(c, 118) + beak(c, 156)
             + f'<path d="M38 170 C20 176 18 196 30 210 C40 200 48 190 50 176 Z" fill="{c["l"]}"/>'
             + f'<path d="M218 170 C236 176 238 196 226 210 C216 200 208 190 206 176 Z" fill="{c["l"]}"/>')
    return tile(c, inner)

V = [("1 · Calm pills", v1), ("2 · Content blink", v2), ("3 · Focus headband", v3),
     ("4 · Side peek", v4), ("5 · Side peek, calm", v5), ("6 · Calm face (no peek)", v6)]
h = ['''<!doctype html><html><head><meta charset="utf-8"><title>Peek variations</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>body{margin:0;font-family:Inter,sans-serif;color:#222;width:1400px}section{padding:30px 48px}
h2{font-size:20px;margin:0 0 18px}.row{display:flex;gap:34px}.ic{display:flex;flex-direction:column;align-items:center;gap:10px;font-size:13px;color:#555;width:190px}
.big{width:180px;height:180px}.sm{display:flex;gap:10px;align-items:end}</style></head><body>''']
for pn, c in pal.items():
    h.append(f'<section style="background:{c["bg"]}"><h2>{pn}</h2><div class="row">')
    for name, fn in V:
        s = fn(c)
        h.append('<div class="ic">' + s.replace('<svg ', '<svg class="big" ', 1) + '<div class="sm">'
                 + "".join(fn(c).replace('<svg ', f'<svg width="{z}" height="{z}" ', 1) for z in (64, 32, 16))
                 + f'</div>{name}</div>')
    h.append('</div></section>')
h.append('</body></html>')
open("peek-variations-v2.html", "w", encoding="utf-8").write("\n".join(h))
