#!/usr/bin/env python3
import json, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
articles = json.loads(Path('/tmp/articles120.json').read_text())
priority_source = (root / 'src/data/articleEditorial.js').read_text()
priority = re.findall(r'^\s*"([a-z0-9-]+)",$', priority_source, re.M)[:20]
by_slug = {x['slug']: x for x in articles}
ordered = [by_slug[s] for s in priority] + [x for x in articles if x['slug'] not in priority]
out = root.parents[0] / 'PREVIEWS'
out.mkdir(exist_ok=True)
font = ImageFont.load_default()
for sheet in range(6):
    batch = ordered[sheet*20:(sheet+1)*20]
    canvas = Image.new('RGB', (1200, 1380), '#f7f2e8')
    draw = ImageDraw.Draw(canvas)
    draw.text((30, 18), f'TaxSimba premium guides {sheet*20+1}–{sheet*20+len(batch)}', fill='#123f32', font=font)
    for i, article in enumerate(batch):
        row, col = divmod(i, 4)
        x, y = 30 + col*292, 62 + row*260
        image = Image.open(root / f"public/images/articles/{article['slug']}-480.webp").convert('RGB')
        image.thumbnail((270, 150))
        canvas.paste(image, (x, y))
        title = article['title'][:72]
        words, lines, current = title.split(), [], ''
        for word in words:
            if len(current) + len(word) + 1 > 36:
                lines.append(current); current = word
            else: current = (current + ' ' + word).strip()
        if current: lines.append(current)
        draw.multiline_text((x, y+160), '\n'.join(lines[:3]), fill='#173f34', font=font, spacing=4)
    canvas.save(out / f'artwork-{sheet+1}.jpg', quality=88)
print(f'Created six artwork review sheets in {out}')
