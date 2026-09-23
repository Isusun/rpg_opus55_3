"""gpt-image-2 で生成した raw 画像（assets/raw）をゲーム用アセット（assets/img）に加工する。
- 地形タイル: 継ぎ目なしテクスチャを 256x256 に縮小（ゲーム側で 4x4 タイル周期として使用）
- スプライトシート: 透過 or マゼンタ背景をキー抜きし、グリッドごとに切り出して正方形に整形
存在しない raw はスキップし、procgen.py が代替画像を作る。
"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
RAW = os.path.join(ROOT, 'assets', 'raw')
OUT = os.path.join(ROOT, 'assets', 'img')
os.makedirs(OUT, exist_ok=True)

TILE_BASE = {  # 透過部分を埋める下地色
    't_carpet': (120, 16, 30), 't_ice': (200, 236, 250), 't_grass': (70, 160, 50), 't_dirt': (150, 110, 70),
    't_sand': (225, 190, 110), 't_swamp': (90, 40, 110), 't_stonewall': (50, 55, 70),
}


def raw(name):
    p = os.path.join(RAW, name + '.png')
    return p if os.path.exists(p) else None


def key_magenta(im):
    """マゼンタ背景を透過にする（既に透過ならそのまま）"""
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # マゼンタらしさ: R,B が高く G が低い
            m = min(r, b) - g
            if m > 110 and r > 150 and b > 150:
                px[x, y] = (0, 0, 0, 0)
            elif m > 60 and r > 120 and b > 120:
                # 縁のにじみ: 半透明＋色抜き
                na = max(0, min(255, int(255 * (110 - m) / 50)))
                px[x, y] = (min(r, g + 40), g, min(b, g + 40), na)
    return im


def fit_square(im, size, pad=0.06):
    bb = im.getbbox()
    if not bb:
        return None
    im = im.crop(bb)
    w, h = im.size
    side = int(max(w, h) * (1 + pad * 2))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    # 足元基準（下寄せ）で中央配置
    canvas.paste(im, ((side - w) // 2, side - h - int(side * pad * 0.5)), im)
    return canvas.resize((size, size), Image.LANCZOS)


def drop_specks(cell, keep_ratio=0.12, step=6):
    """隣のマスからはみ出した小さな破片を取り除く（最大の塊に比べて小さい塊を消す）"""
    w, h = cell.size
    a = cell.split()[3].load()
    gw, gh = (w + step - 1) // step, (h + step - 1) // step
    occ = [[False] * gw for _ in range(gh)]
    for gy in range(gh):
        for gx in range(gw):
            for y in range(gy * step, min(h, gy * step + step), 2):
                if any(a[x, y] > 40 for x in range(gx * step, min(w, gx * step + step), 2)):
                    occ[gy][gx] = True
                    break
    comp = [[-1] * gw for _ in range(gh)]
    sizes = []
    for gy in range(gh):
        for gx in range(gw):
            if occ[gy][gx] and comp[gy][gx] < 0:
                cid = len(sizes); stack = [(gx, gy)]; comp[gy][gx] = cid; n = 0
                while stack:
                    x, y = stack.pop(); n += 1
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < gw and 0 <= ny < gh and occ[ny][nx] and comp[ny][nx] < 0:
                            comp[ny][nx] = cid; stack.append((nx, ny))
                sizes.append(n)
    if len(sizes) <= 1:
        return cell
    big = max(sizes)
    px = cell.load()
    for gy in range(gh):
        for gx in range(gw):
            c = comp[gy][gx]
            if c >= 0 and sizes[c] < big * keep_ratio:
                for y in range(gy * step, min(h, gy * step + step)):
                    for x in range(gx * step, min(w, gx * step + step)):
                        px[x, y] = (0, 0, 0, 0)
    return cell


def split_grid(im, cols, rows, names, size):
    W, H = im.size
    cw, ch = W / cols, H / rows
    out = {}
    for i, n in enumerate(names):
        if n is None:
            continue
        c, r = i % cols, i // cols
        box = (int(c * cw), int(r * ch), int((c + 1) * cw), int((r + 1) * ch))
        cell = drop_specks(im.crop(box))
        # ノイズ除去: ほぼ透明な画素は無視
        a = cell.split()[3].point(lambda v: 255 if v > 40 else 0)
        bb = a.getbbox()
        if not bb:
            continue
        cell = cell.crop(bb)
        sq = fit_square(cell, size)
        if sq:
            out[n] = sq
    return out


def process_tiles():
    names = ['grass', 'dirt', 'sand', 'snow', 'water', 'swamp', 'lava', 'stonefloor', 'stonewall', 'cobble', 'wood', 'brick', 'ice', 'carpet', 'bridge']
    for n in names:
        p = raw('t_' + n)
        if not p:
            continue
        im = Image.open(p).convert('RGBA')
        base = Image.new('RGBA', im.size, TILE_BASE.get('t_' + n, (0, 0, 0)) + (255,))
        base.alpha_composite(im)
        base.convert('RGB').resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, 'tile_' + n + '.jpg'), quality=90)
        print('tile', n)


def process_sheet(rawname, cols, rows, names, size, prefix=''):
    p = raw(rawname)
    if not p:
        return False
    im = key_magenta(Image.open(p))
    parts = split_grid(im, cols, rows, names, size)
    for n, spr in parts.items():
        spr.save(os.path.join(OUT, prefix + n + '.png'))
    print('sheet', rawname, len(parts))
    return True


def process_single(rawname, size, outname):
    p = raw(rawname)
    if not p:
        return False
    im = key_magenta(Image.open(p))
    sq = fit_square(im, size, pad=0.03)
    if sq:
        sq.save(os.path.join(OUT, outname + '.png'))
        print('single', rawname)
    return True


def process_bg(rawname, outname, w=960, h=640):
    p = raw(rawname)
    if not p:
        return False
    im = Image.open(p).convert('RGB')
    # cover-fit
    sw, sh = im.size
    s = max(w / sw, h / sh)
    im = im.resize((int(sw * s), int(sh * s)), Image.LANCZOS)
    x, y = (im.size[0] - w) // 2, (im.size[1] - h) // 2
    im.crop((x, y, x + w, y + h)).save(os.path.join(OUT, outname + '.jpg'), quality=84)
    print('bg', rawname)
    return True


if __name__ == '__main__':
    process_tiles()
    process_sheet('s_heroes', 3, 2, ['hero_warrior', 'hero_knight', 'hero_mage', 'hero_priest', 'hero_thief', 'hero_monk'], 128)
    process_sheet('s_npcs', 4, 2, ['npc_man', 'npc_woman', 'npc_elder', 'npc_child', 'npc_merchant', 'npc_guard', 'npc_sage', 'npc_sailor'], 128)
    process_sheet('s_orbs', 3, 2, ['orb1', 'orb2', 'orb3', 'orb4', 'orb5', 'orb6'], 96)
    process_sheet('s_objects1', 4, 4, ['obj_tree', 'obj_pine', 'obj_mountain', 'obj_rock', 'obj_chest', 'obj_chest_open', 'obj_stairs_down', 'obj_stairs_up',
                                        'obj_door', 'obj_irondoor', 'obj_switch', 'obj_switch_on', 'obj_town', 'obj_cave', 'obj_tower', 'obj_castle'], 96)
    process_sheet('s_objects2', 4, 4, ['obj_fence', 'obj_flowers', 'obj_counter', 'obj_bed', 'obj_well', 'obj_sign', 'obj_crystal', 'obj_altar',
                                        'obj_statue', 'obj_brazier', 'obj_barrel', 'obj_bookshelf', 'obj_portal', 'obj_cactus', 'obj_palm', 'obj_grave'], 96)
    for k in range(1, 5):
        process_sheet('s_enemies%d' % k, 3, 3, ['e%d_%d' % (k, i) for i in range(9)], 160)
    for b in ['b_wolf', 'b_scorpion', 'b_serpent', 'b_dragon', 'b_prism', 'b_knight', 'b_yomi1', 'b_yomi2', 'b_amnes']:
        process_single(b, 320, b)
    for bg in ['bg_plains', 'bg_cave', 'bg_desert', 'bg_temple', 'bg_volcano', 'bg_snow', 'bg_grave', 'bg_tower', 'bg_reverse']:
        process_bg(bg, bg)
    process_bg('title', 'title', 1280, 800)
    # 生成できなかった背景・タイトルは、生成済みのAI画像を組み合わせて作る
    import compose_missing
    compose_missing.run(raw)
