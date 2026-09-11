"""Build decorative public WebP copies; requires Pillow. Never changes the source."""
from pathlib import Path
from PIL import Image, ImageOps
import sys

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'Assests/bg3.png'
target = root / 'apps/web/public/backgrounds'
target.mkdir(parents=True, exist_ok=True)
with Image.open(source) as original:
    image = ImageOps.exif_transpose(original).convert('RGB')
    for name, width, quality in [('desktop', 1920, 85), ('mobile', 960, 82)]:
        output = target / f'vaanisetu-{name}.webp'
        if output.resolve() == source.resolve():
            raise ValueError('The output must not overwrite the original')
        resized = image.copy()
        resized.thumbnail((width, width), Image.Resampling.LANCZOS)
        resized.save(output, 'WEBP', quality=quality, method=6)
        print(f'{output.name}: {output.stat().st_size} bytes')
