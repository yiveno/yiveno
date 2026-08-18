from pathlib import Path
from PIL import Image
import cairosvg

root = Path('/home/ubuntu/yiveno-brand-kit')
logo_source = Path('/home/ubuntu/upload/logo.svg').read_text()
out = root / 'chrome-extension'
out.mkdir(parents=True, exist_ok=True)

# The original mark is the source of truth. Only color treatment and surrounding field change.
light_svg = logo_source.replace('width="80" height="80"', 'width="800" height="800"')
# Dark-theme treatment: pale mark on a dark field, retaining the orbital structure.
dark_svg = logo_source.replace('width="80" height="80"', 'width="800" height="800"')
dark_svg = dark_svg.replace('#192420', '#F4F5F0').replace('#4B6054', '#CFE2D7')
dark_svg = dark_svg.replace('#9BB3A6', '#CFE2D7').replace('#CFE2D7', '#DDEBE3')

(out / 'yiveno-logo-on-light.svg').write_text(light_svg)
(out / 'yiveno-logo-on-dark.svg').write_text(dark_svg)

# Self-contained Chrome extension icon: dark rounded field + pale mark.
icon_svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 80 80">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#192420"/><stop offset="1" stop-color="#4B6054"/></linearGradient>
<linearGradient id="mark" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#F4F5F0"/><stop offset="1" stop-color="#CFE2D7"/></linearGradient>
</defs>
<rect width="80" height="80" rx="18" fill="url(#bg)"/>
<ellipse cx="40" cy="69" rx="29" ry="7" fill="none" stroke="#CFE2D7" stroke-opacity=".28" stroke-width="1.6"/>
<ellipse cx="40" cy="69" rx="20" ry="5" fill="none" stroke="#CFE2D7" stroke-opacity=".42" stroke-width="1.35"/>
<ellipse cx="40" cy="69" rx="12" ry="3" fill="none" stroke="#CFE2D7" stroke-opacity=".58" stroke-width="1.2"/>
<path d="M40.4 40.5L16.5 18.5M40.4 40.5L63 18.5M40.4 40.5V65" stroke="url(#mark)" stroke-width="12" stroke-linecap="round"/>
<circle cx="41" cy="8" r="8" fill="url(#mark)"/>
</svg>'''
(out / 'yiveno-extension-icon.svg').write_text(icon_svg)

# Render all required sizes.
def render(svg_path: Path, png_path: Path, size: int):
    cairosvg.svg2png(url=str(svg_path), write_to=str(png_path), output_width=size, output_height=size)

for size in [16, 32, 48, 128, 256, 512]:
    render(out / 'yiveno-extension-icon.svg', out / f'icon-{size}.png', size)

# Multi-resolution favicon for browser and extension-adjacent surfaces.
imgs = [Image.open(out / f'icon-{s}.png').convert('RGBA') for s in [16, 32, 48, 128, 256, 512]]
imgs[0].save(out / 'favicon.ico', format='ICO', sizes=[(16,16),(32,32),(48,48),(128,128),(256,256),(512,512)])

# Light/dark logo PNG exports.
render(out / 'yiveno-logo-on-light.svg', out / 'yiveno-logo-on-light.png', 800)
render(out / 'yiveno-logo-on-dark.svg', out / 'yiveno-logo-on-dark.png', 800)
print('Generated Chrome extension brand assets in', out)
