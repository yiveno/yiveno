from pathlib import Path
from PIL import Image, ImageOps

root = Path('/home/ubuntu/yiveno-brand-kit/chrome-extension')
exports = [
    ('store-promo-marquee-concept.png', 'promotional-banner-marquee-1400x560.png', (1400, 560)),
    ('store-promo-tile-concept.png', 'promotional-banner-small-440x280.png', (440, 280)),
    ('store-feature-focus.png', 'store-screenshot-focus-1280x800.png', (1280, 800)),
    ('store-feature-connect.png', 'store-screenshot-connect-1280x800.png', (1280, 800)),
]
for source_name, target_name, size in exports:
    image = Image.open(root / source_name).convert('RGB')
    fitted = ImageOps.fit(image, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    fitted.save(root / target_name, optimize=True)
    print(target_name, fitted.size)
