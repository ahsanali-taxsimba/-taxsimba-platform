#!/usr/bin/env python3
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ARTICLES = json.loads(Path('/tmp/articles120.json').read_text())
SOURCE = Path('/workspace/scratch/b29a6019351e/generated_images')
files = sorted(
    [p for p in SOURCE.glob('exec-*.png') if p.stat().st_size > 1_000_000],
    key=lambda p: p.stat().st_mtime,
)[-120:]
assert len(ARTICLES) == 120 and len(files) == 120

out = ROOT / 'public/images/articles'
out.mkdir(parents=True, exist_ok=True)
manifest = []
for article, src in zip(ARTICLES, files):
    slug = article['slug']
    with Image.open(src) as original:
        rgb = original.convert('RGB')
        for width in (480, 960, 1440):
            canvas = Image.new('RGB', (width, width * 5 // 12), '#f2eadc')
            fitted = ImageOps.contain(rgb, canvas.size, Image.Resampling.LANCZOS)
            canvas.paste(fitted, ((canvas.width-fitted.width)//2, (canvas.height-fitted.height)//2))
            target = out / f'{slug}-{width}.webp'
            pending = target.with_suffix('.pending')
            canvas.save(pending, 'WEBP', quality=82, method=6)
            pending.replace(target)
    manifest.append({
        'slug': slug,
        'src': f'/images/articles/{slug}-960.webp',
        'srcSet': ', '.join(f'/images/articles/{slug}-{w}.webp {w}w' for w in (480,960,1440)),
        'width': 1440,
        'height': 600,
    })

js = 'export const articleArtwork = ' + json.dumps({x['slug']: x for x in manifest}, indent=2) + ';\n\nexport function getArticleArtwork(slug) { return articleArtwork[slug] || null; }\n'
(ROOT / 'src/data/articleArtwork.js').write_text(js)
print(f'Prepared {len(manifest)} illustrations / {len(manifest)*3} responsive assets')
