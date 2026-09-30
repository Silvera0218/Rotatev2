"""Convert the generated transparent icon artwork into grid-aligned SVG paths.
No bitmap is embedded in the SVG. Source PNGs are kept beside the outputs.
"""
from pathlib import Path
import sys
from collections import defaultdict
from PIL import Image
from sympy import Rational, floor

folder=Path(__file__).resolve().parent
names={'shovel':'铲子','swap':'换块','supply':'补给箱','dye':'调色瓶','repair':'修补胶带'}
for name in (sys.argv[1:] or names):
    source=Image.open(folder/f'{name}-source.png').convert('RGBA')
    # Remove soft translucent glow; retain the solid shape from the generated art.
    alpha=source.getchannel('A').point(lambda v:255 if v>=190 else 0)
    source.putalpha(alpha)
    source=source.crop(alpha.getbbox())
    scale=min(Rational(30,source.width),Rational(30,source.height))
    size=(int(floor(source.width*scale)),int(floor(source.height*scale)))
    small=source.resize(size,Image.Resampling.NEAREST)
    canvas=Image.new('RGBA',(32,32),(0,0,0,0))
    canvas.alpha_composite(small,((32-size[0])//2,(32-size[1])//2))
    alpha=canvas.getchannel('A')
    colors=['061b50','204273','437da7','7dafd9','b6e2fc','f5fcff','9d6032','e9a052','ffdc94','317d33','77bf14','bcf51c','efff79','00bee8','008fe8','17b721']
    palette=Image.new('P',(1,1))
    palette.putpalette([channel for color in colors for channel in bytes.fromhex(color)]+[0]*(768-len(colors)*3))
    quant=canvas.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGB')
    paths=defaultdict(list)
    for y in range(32):
        x=0
        while x<32:
            if alpha.getpixel((x,y))==0:
                x+=1
                continue
            rgb=quant.getpixel((x,y));end=x+1
            while end<32 and alpha.getpixel((end,y)) and quant.getpixel((end,y))==rgb:
                end+=1
            paths['#%02x%02x%02x'%rgb].append(f'M{x} {y}h{end-x}v1H{x}z')
            x=end
    title=names[name]
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges" role="img" aria-label="{title}"><title>{title}</title>'
    svg+=''.join(f'<path fill="{color}" d="{"".join(commands)}"/>' for color,commands in paths.items())+'</svg>\n'
    (folder/f'{name}.svg').write_text(svg,encoding='utf-8')
    preview=quant.convert('RGBA');preview.putalpha(alpha)
    preview.resize((320,320),Image.Resampling.NEAREST).save(folder/f'{name}-pixel-preview.png')
    print(name,'grid=32x32','colors='+str(len(paths)),'SVG bytes='+str(len(svg.encode())))
