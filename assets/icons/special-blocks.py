"""Front-facing single material tiles, shared by icons and falling cells."""
from pathlib import Path
folder=Path(__file__).resolve().parent
tiles={
 'bonus':('加分块','#e5b952','#fff0a0','#a57534',[
 ('#f5d878','M6 6h9v3H6zM18 15h7v7h-7z'),('#bd8839','M5 19h8v2H5zM14 5h2v5h-2zM18 12h8v2h-8z'),('#fff5bd','M8 10h2v2h-2zM20 6h2v2h-2zM14 22h3v2h-3z')]),
 'chameleon':('随色块','#79b8ee','#ceeaff','#426da3',[
 ('#a8d8ff','M6 6h13v2H6zM6 8h3v7H6z'),('#93c9f8','M14 11h10v9H14z'),('#5c96d0','M6 23h17v3H6zM24 8h2v15h-2z'),('#efffff','M22 20h2v8h-2zM19 23h8v2h-8z')]),
 'coin':('金币块','#b98557','#efd59e','#785338',[
 ('#916442','M4 13h8v2H4zM12 4h2v11h-2zM16 21h11v2H16z'),('#ffdf77','M7 7h5v4H7zM18 9h6v5h-6zM9 20h5v5H9z'),('#fff2b0','M7 7h4v1H7zM18 9h5v1h-5zM9 20h4v1H9z')]),
 'link':('连携块','#a1acb8','#dbe5ec','#626e81',[
 ('#778392','M11 3h2v6h-2zM8 9h5v2H8zM6 11h4v2H6zM3 13h5v2H3zM12 10h5v2h-5zM17 11h2v7h-2zM19 17h7v2h-7zM11 20h8v2h-8zM9 21h3v8H9z'),('#bec7d0','M5 5h5v3H5zM15 5h10v3H15zM4 17h6v3H4zM19 22h6v4h-6z')]),
 'pigment':('取色块','#81c7aa','#ceffe6','#477b70',[
 ('#a9e7b2','M5 5h11v10H5z'),('#64b8ca','M17 5h10v10H17z'),('#e5d68c','M5 17h10v10H5z'),('#a4aadf','M17 17h10v10H17z'),('#d8fff0','M5 5h9v2H5zM18 17h7v2h-7z')])}
for key,(name,face,light,edge,details) in tiles.items():
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges" role="img" aria-label="{name}"><title>{name}</title>'
    svg+='<path fill="#35445e" d="M4 1h24v2h2v25h-2v2H4v-2H2V3h2z"/>'
    svg+=f'<path fill="{face}" d="M4 3h24v25H4z"/><path fill="{light}" d="M5 3h22v2H5zM4 5h2v21H4z"/><path fill="{edge}" d="M26 5h2v23H6v-2h20z"/>'
    svg+=''.join(f'<path fill="{color}" d="{path}"/>' for color,path in details)
    svg+='</svg>\n';(folder/f'block-{key}.svg').write_text(svg,encoding='utf-8')
    print('material tile:',key)
