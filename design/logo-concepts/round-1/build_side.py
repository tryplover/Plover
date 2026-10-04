pal = {
  "Shoreline": dict(p="#1F4E5A", l="#EFE4CF", a="#E8875B", d="#12323A", w="#D8C3A0", bg="#F8F3EA"),
  "Sage":      dict(p="#5E7F6B", l="#F3EEE1", a="#E3B55B", d="#2F4236", w="#D9CFB4", bg="#F6F3EA"),
  "Mono":      dict(p="#111111", l="#FFFFFF", a="#FFFFFF", d="#111111", w="#FFFFFF", bg="#F2F2F2"),
}
n=[0]
def uid():
    n[0]+=1; return f"s{n[0]}"
CX, CY, R = 168, 226, 112
def svg(c, band=None, tip=False):
    i, j = uid(), uid()
    out = [f'<svg viewBox="0 0 256 256"><defs><clipPath id="{i}"><rect width="256" height="256" rx="56"/></clipPath>'
           f'<clipPath id="{j}"><circle cx="{CX}" cy="{CY}" r="{R}"/></clipPath></defs>'
           f'<rect width="256" height="256" rx="56" fill="{c["p"]}"/><g clip-path="url(#{i})">'
           f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="{c["l"]}"/>']
    if band:
        t, w = band
        out.append(f'<path clip-path="url(#{j})" d="M40 {t+10} Q160 {t-26} 260 {t-6} V{t-6+w} Q160 {t-26+w} 40 {t+10+w} Z" fill="{c["d"]}"/>')
    out.append(f'<path d="M108 168 Q122 182 136 168" fill="none" stroke="{c["d"]}" stroke-width="8" stroke-linecap="round"/>')
    bk = c["a"] if c is not pal["Mono"] else c["l"]
    if c is pal["Mono"]:
        out.append(f'<path d="M66 178 Q40 186 22 196 Q42 206 68 212 Z" fill="{c["p"]}" stroke="{c["p"]}" stroke-width="20" stroke-linejoin="round"/>')
    out.append(f'<path d="M66 178 Q40 186 22 196 Q42 206 68 212 Z" fill="{bk}" stroke="{bk}" stroke-width="8" stroke-linejoin="round"/>')
    if tip:
        out.append(f'<path d="M40 190 Q30 193 22 196 Q31 200 40 203 Z" fill="{c["d"]}" stroke="{c["d"]}" stroke-width="8" stroke-linejoin="round"/>')
    if c is pal["Mono"]:
        out.append(f'<path d="M138 260 C138 236 152 222 164 210 C176 222 190 236 190 260 Z" fill="{c["p"]}" />'
                   f'<path d="M146 260 C146 240 156 230 164 221 C172 230 182 240 182 260 Z" fill="{c["l"]}" />')
    else:
        out.append(f'<path d="M138 260 C138 236 152 222 164 210 C176 222 190 236 190 260 Z" fill="{c["w"]}" stroke="{c["l"]}" stroke-width="5" stroke-linejoin="round"/>')
    out.append('</g></svg>')
    return "".join(out)
V = [("5 · Calm side peek", {}), ("5 + beak tip", {"tip": True}),
     ("5 + thin headband", {"band": (140, 12)}), ("5 + bold headband", {"band": (136, 20)})]
h = ['''<!doctype html><html><head><meta charset="utf-8"><title>Side peek</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>body{margin:0;font-family:Inter,sans-serif;color:#222;width:1100px}section{padding:26px 48px}
h2{font-size:18px;margin:0 0 14px}.row{display:flex;gap:44px}.ic{display:flex;flex-direction:column;align-items:center;gap:10px;font-size:13px;color:#555;width:200px}
.big{width:190px;height:190px}.sm{display:flex;gap:10px;align-items:end}</style></head><body>''']
for pn, c in pal.items():
    h.append(f'<section style="background:{c["bg"]}"><h2>{pn}</h2><div class="row">')
    for name, kw in V:
        h.append('<div class="ic">' + svg(c, **kw).replace('<svg ', '<svg class="big" ', 1) + '<div class="sm">'
                 + "".join(svg(c, **kw).replace('<svg ', f'<svg width="{z}" height="{z}" ', 1) for z in (64, 32, 16))
                 + f'</div>{name}</div>')
    h.append('</div></section>')
open("side-peek.html", "w", encoding="utf-8").write("\n".join(h) + "</body></html>")
