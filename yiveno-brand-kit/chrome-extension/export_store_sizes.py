from pathlib import Path
from PIL import Image, ImageOps

root = Path('/home/ubuntu/yiveno-brand-kit/chrome-extension')
exports = [
    ('chrome-web-store-small-promo.png', 'chrome-web-store-small-promo-440x280.png', (440, 280)),
    ('chrome-web-store-marquee.png', 'chrome-web-store-marquee-1400x560.png', (1400, 560)),
]
for source_name, target_name, size in exports:
    image = Image.open(root / source_name).convert('RGB')
    fitted = ImageOps.fit(image, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    fitted.save(root / target_name, optimize=True)
    print(root / target_name, fitted.size)
