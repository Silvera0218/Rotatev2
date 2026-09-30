# 道具图标

特殊方块采用正面单格材质，按用户的石纹和玻璃参考制作；没有透视立方体或覆盖在方块上的大符号。`special-blocks.py` 输出五个纯路径 SVG：`block-bonus.svg`（金属）、`block-chameleon.svg`（蓝玻璃）、`block-coin.svg`（矿石）、`block-link.svg`（裂纹石材）、`block-pigment.svg`（彩色拼格）。装备栏显示单个材质方块，棋盘渲染使用同一材质覆盖整个格子。圆形按钮框由界面提供，不包含在 SVG 中。

以下为五种普通道具的生成与转换记录。

先使用内置 imagegen 生成透明底设计稿，再用 `vectorize.py` 采样为 32 × 32 网格、保留有限色板，并按同色横向格段导出 SVG path。SVG 没有内嵌位图。

- `shovel-source.png` → `shovel.svg`：冰蓝金属铲面、木柄、青柠 D 形把手。
- `swap-source.png` → `swap.svg`：青蓝向右箭头、青柠向左箭头。
- `supply-source.png` → `supply.svg`：蓝色补给箱、青柠扣件、方块标记。
- `dye-source.png` → `dye.svg`：冰蓝玻璃瓶、青柠颜料、水滴标签。
- `repair-source.png` → `repair.svg`：青柠胶带卷、冰蓝内圈与短尾。
- `*-pixel-preview.png`：SVG 对应网格的放大预览。

生成方式：内置 imagegen，透明背景。生成稿原件已复制到本目录，游戏按钮和骰子奖励均引用 SVG。

新增三件道具的完整生成提示词保存在 [new-tool-prompts.md](new-tool-prompts.md)。所有图标都使用同一转换脚本与调色板。

## 生成提示词

Shovel: Create one transparent-background game UI item icon: a small hand shovel / spade, diagonal bottom-left blade to top-right D-shaped handle. It is for ROTATION, a cheerful colorful voxel puzzle game with pale blue circular buttons, royal blue pixel outlines and lime accents. Strong instantly readable chunky silhouette at a tiny 32px display size. Metallic icy-blue shovel blade with 2 simple broad highlight planes, short warm tan shaft, bright lime D handle, dark navy outline. Clean deliberate pixel-art concept, coherent square pixel steps as if authored on a 32x32 pixel grid then enlarged with nearest neighbor. Limited 8-10 flat colors. Single centered object with generous transparent padding, whole object visible. No circular button background, no text, no letters, no numbers, no watermark, no shadow outside object, no glow, no blur. Must be a shovel, not pickaxe or wrench.

Swap: Create one transparent-background game UI item icon: TWO thick opposite-direction horizontal arrows representing swap current puzzle piece. Upper arrow points right and is icy cyan blue; lower arrow points left and is bright lime green. Compact balanced single symbol, large pixel arrowheads and squared shafts with a small gap separating arrows; not circular refresh arrows. It is for ROTATION, cheerful colorful voxel puzzle game with pale blue circular buttons and royal blue outlines. Bold dark navy pixel outline, very restrained flat highlights, instant legibility at tiny 32px. Clean deliberate pixel-art concept as if authored on a 32x32 square pixel grid then enlarged nearest neighbor. Limited 6-8 flat colors. Single centered symbol with generous transparent padding. No button background, no text or letters or numbers, no watermark, no separate objects, no outside drop shadow, no glow or blur.
