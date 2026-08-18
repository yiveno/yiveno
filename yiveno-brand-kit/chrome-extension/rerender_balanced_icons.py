from pathlib import Path
from PIL import Image
import cairosvg

root = Path('/home/ubuntu/yiveno-brand-kit/chrome-extension')
svg = root / 'yiveno-extension-icon.svg'
for size in [16, 32, 48, 128, 256, 512]:
    cairosvg.svg2png(url=str(svg), write_to=str(root / f'icon-{size}.png'), output_width=size, output_height=size)
images = [Image.open(root / f'icon-{size}.png').convert('RGBA') for size in [16, 32, 48, 128, 256, 512]]
images[0].save(root / 'favicon.ico', format='ICO', sizes=[(16,16),(32,32),(48,48),(128,128),(256,256),(512,512)])
print('Balanced icon exports refreshed.')
