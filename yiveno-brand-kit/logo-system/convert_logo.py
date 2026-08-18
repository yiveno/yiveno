from pathlib import Path
import cairosvg

source = Path('/home/ubuntu/upload/logo.svg')
target = Path('/home/ubuntu/yiveno-brand-kit/logo-system/yiveno-mark-reference.png')
cairosvg.svg2png(url=str(source), write_to=str(target), output_width=800, output_height=800)
print(target)
