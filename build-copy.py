"""Build the lightweight derivative from the unchanged original game."""
from pathlib import Path
import json
root = Path(__file__).resolve().parent
source = (root / 'source' / 'base-game.html').read_text(encoding='utf-8')
dice_routes=json.dumps(json.loads((root/'lite-dice-routes.json').read_text(encoding='utf-8')),separators=(',',':'))
def replace_once(old, new):
    global source
    if source.count(old) != 1:
        raise RuntimeError(f'Expected one integration marker: {old[:90]} ({source.count(old)})')
    source = source.replace(old, new, 1)
replace_once('<html lang="zh-CN"', '<html data-lite="true" lang="zh-CN"')
replace_once('<title>ROTATION</title>', '<title>ROTATION · 骰子轻量版</title>')
replace_once('</head>', '<link rel="stylesheet" href="./lite-ui.css"><link rel="stylesheet" href="./lite-integration.css"><link rel="stylesheet" href="./lite-extra-rewards.css"></head>')
replace_once('<script>(()=>{', '<script>globalThis.LITE_DICE_ROUTES='+dice_routes+';</script><script src="./lite-rules.js"></script><script src="./lite-dice-geometry.js"></script><script src="./lite-dice.js"></script><script src="./lite-transition.js"></script><script src="./lite-blocks.js"></script><script src="./lite-acquisition.js"></script><script src="./lite-extra-rewards.js"></script><script>(()=>{')
replace_once('C5=RotationMechanics.makeScorer(C5);', 'C5=RotationMechanics.makeScorer(C5);globalThis.installRotationLite({Game:e9,mechanics:RotationMechanics});')
# Charge only attached placements. Misses keep their existing life penalty,
# and the next spawn must see the unchanged budget even on the last drop.
replace_once('this.dropsUsed+=this.active.origin==="inserted"?nt.specialDropCost:nt.ordinaryDropCost,this.rotationCredited=!1', 'const liteDropCost=this.active.origin==="inserted"?nt.specialDropCost:nt.ordinaryDropCost;this.rotationCredited=!1')
replace_once('if(this.build.placement.attached=r,r){let a=[];', 'if(this.build.placement.attached=r,r){this.dropsUsed+=liteDropCost;let a=[];')
replace_once(' function medallion(id){', ''' Object.assign(buffArt,{'extra-moves':buffArt.patience,'shovel-supply':buffArt.frontier_edge,'clear-score':buffArt.spare_change,'bonus-score':buffArt.opening_act});
 function medallion(id){''')
# Register lightweight destinations with the same pixel assembly effect as native dialogs.
replace_once('const key=shown?[overlay.dataset.plan,overlay.dataset.pause,overlay.dataset.reading,', 'const key=shown?[overlay.dataset.litePage,overlay.dataset.plan,overlay.dataset.pause,overlay.dataset.reading,')
replace_once("attributeFilter:['hidden','data-home','data-plan','data-pause','data-reading','data-gift','data-buff-detail']", "attributeFilter:['hidden','data-home','data-plan','data-pause','data-reading','data-gift','data-buff-detail','data-lite-page']")
# A full-screen pixel wipe owns reward-to-reward motion; keep native motion elsewhere.
replace_once('if(value)burst(target);else target.dataset.arcEntry=\'pending\';', 'if(value&&target===panel&&overlay.dataset.liteReward===\'true\'){delete target.dataset.arcEntry;}else if(value)burst(target);else target.dataset.arcEntry=\'pending\';')
replace_once('  f5();V3();requestAnimationFrame(F6);', '\n/* LITE_UI_BEGIN: existing engine and scene integration */\n' + (root/'lite-integration.js').read_text(encoding='utf-8') + '\n/* LITE_UI_END */\n  f5();V3();requestAnimationFrame(F6);')
replace_once('za.sync(),La(),$f(),N6.render()', 'za.sync(),liteFrame(),La(),$f(),N6.render()')
replace_once('yt>=.85&&(yt=0,L.step(!0)', 'liteNaturalFall&&yt>=.85&&(yt=0,L.step(!0)')
# Keep the scored cells with their feedback, including queued chain clears.
replace_once('Of(n.scoring),se.play("clear")', 'Of(n.scoring,n.cells),se.play("clear")')
# Mark special cells using the existing rendered material effects, without enabling
# the original gameplay effects. The underlying blocks keep liteEffect metadata.
replace_once('var ln=new Y7(lt,K3+4)', 'var liteBlockFx=createLiteBlockEffects(lt,{BoxGeometry:Dt,InstancedMesh:ut,MeshStandardMaterial:Zt,Texture:ct,Matrix4:oe,Vector3:U},K3+4,()=>{fe.dirty=true});var ln=new Y7(lt,K3+4)')
replace_once('ln.begin();starCellFx.begin(L.build);', 'ln.begin();starCellFx.begin(L.build);liteBlockFx.begin();')
replace_once('starCellFx.add(g,w,b,y,A,M),ln.add(g,w,b,y,A,M)', 'liteBlockFx.add(g,w,b,y,A,M),starCellFx.add(g,w,b,y,A,M),ln.add(g,w,b,y,A,M)')
replace_once('ln.finish(),starCellFx.finish(),', 'ln.finish(),starCellFx.finish(),liteBlockFx.finish(),')
replace_once('c5(u5,l,w,b,y-.025,A,M),c5(N1,l,w,b,y,A,M),c5(l3,l,w-.025,b+.025,y+.185,A,M)', 'c5(u5,l,w,b,y-.025,g.liteEffect?0:A,M),c5(N1,l,w,b,y,g.liteEffect?0:A,M),c5(l3,l,w-.025,b+.025,y+.185,g.liteEffect?0:A,M)')
replace_once('<script id="rotation-pwa" src="./rotation-pwa-register.js" defer></script>', '')
# Copy uses its own run/settings keys. It never reads or deletes the original run.
source=source.replace('bearingRotorInsertionUISuspendedRunV1','rotationLiteSuspendedRunV1').replace('bearingRotorInsertionEndlessUnlockedV1','rotationLiteUnusedEndlessV1')
source=source.replace('rotation.webmanifest','lite.webmanifest')
(root/'index.html').write_text(source,encoding='utf-8')
print('Built lite/index.html from original + isolated lightweight rules/UI.')
