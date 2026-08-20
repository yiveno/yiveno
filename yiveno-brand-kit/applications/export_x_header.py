from pathlib import Path
from PIL import Image, ImageOps

source = Path('/home/ubuntu/yiveno-brand-kit/applications/yiveno-x-header-concept.png')
target = Path('/home/ubuntu/yiveno-brand-kit/applications/yiveno-x-header-1500x500.png')
image = Image.open(source).convert('RGB')
export = ImageOps.fit(image, (1500, 500), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
export.save(target, optimize=True, quality=95)
print(target, export.size)
