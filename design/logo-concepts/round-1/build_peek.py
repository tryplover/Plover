pal = {
  "Shoreline": dict(p="#1F4E5A", l="#EFE4CF", a="#E8875B", d="#12323A", bg="#F8F3EA"),
  "Sage":      dict(p="#5E7F6B", l="#F3EEE1", a="#E3B55B", d="#2F4236", bg="#F6F3EA"),
}
n = [0]
def uid():
    n[0] += 1; return f"k{n[0]}"

HEAD = '<circle cx="128" cy="250" r="118" fill="{l}"/>'
def wings_round(c):
    return "".join(f'<path d="M{x-27} 256 A27 24 0 0 1 {x+27} 256 Z" fill="{c["l"]}" stroke="{c["p"]}" stroke-width="8"/>' for x in (66,190))
def wings_feather(c):
    return "".join(f'<path d="M{x-24} 258 C{x-24} 238 {x-10} 226 {x} 216 C{x+10} 226 {x+24} 238 {x+24} 258 Z" fill="{c["l"]}" stroke="{c["p"]}" stroke-width="8" stroke-linejoin="round"/>' for x in (64,192))
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

def v1(c):  # calm pills
    return tile(c, HEAD.format(**c) + pills(c) + beak(c, 214) + wings_round(c))
def v2(c):  # content blink
    return tile(c, HEAD.format(**c) + blink(c) + beak(c, 210) + wings_round(c))
def v3(c):  # plover mask band
    j = uid()
    inner = (f'<defs><clipPath id="{j}"><circle cx="128" cy="250" r="118"/></clipPath></defs>' + HEAD.format(**c)
             + f'<path clip-path="url(#{j})" d="M0 168 Q128 150 256 168 V202 Q128 190 0 202 Z" fill="{c["d"]}"/>'
             + dots(c, 184, 7.5, c["l"]) + beak(c, 212, tip=True) + wings_feather(c))
    return tile(c, inner)
def v4(c):  # feather wings + pills
    return tile(c, HEAD.format(**c) + pills(c) + beak(c, 214, tip=True) + wings_feather(c))
def v5(c):  # side peek, profile
    j = uid()
    inner = (f'<defs><clipPath id="{j}"><circle cx="190" cy="236" r="108"/></clipPath></defs>'
             f'<circle cx="190" cy="236" r="108" fill="{c["l"]}"/>'
             f'<path clip-path="url(#{j})" d="M60 200 Q150 188 300 172 V196 Q150 214 60 222 Z" fill="{c["d"]}" opacity="0"/>'
             f'<rect x="146" y="168" width="16" height="30" rx="8" fill="{c["d"]}"/>'
             f'<path d="M92 196 L50 213 L94 228 Z" fill="{c["a"]}" stroke="{c["a"]}" stroke-width="8" stroke-linejoin="round"/>'
             f'<path d="M156 258 C156 238 172 224 186 214 C198 226 210 240 210 258 Z" fill="{c["l"]}" stroke="{c["p"]}" stroke-width="8" stroke-linejoin="round"/>')
    return tile(c, inner)
def v6(c):  # full calm face, not peeking
    inner = (f'<path d="M128 46 C200 46 222 104 222 150 C222 206 182 230 128 230 C74 230 34 206 34 150 C34 104 56 46 128 46 Z" fill="{c["l"]}"/>'
             + pills(c, 118) + beak(c, 156)
             + f'<path d="M38 170 C20 176 18 196 30 210 C40 200 48 190 50 176 Z" fill="{c["l"]}"/>'
             + f'<path d="M218 170 C236 176 238 196 226 210 C216 200 208 190 206 176 Z" fill="{c["l"]}"/>')
    return tile(c, inner)

V = [("1 · Calm pills", v1), ("2 · Content blink", v2), ("3 · Plover mask", v3),
     ("4 · Feather wings", v4), ("5 · Side peek", v5), ("6 · Calm face (no peek)", v6)]
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
open("peek-variations.html", "w", encoding="utf-8").write("\n".join(h))
