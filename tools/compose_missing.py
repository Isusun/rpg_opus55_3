"""gpt-image-2 で生成できなかった背景・タイトルを、生成済みのAI画像の加工・合成で作る。
raw（AI原画）がある物はそちらを優先し、ここでは作らない。"""
import os, math, random
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = os.path.join(os.path.dirname(__file__), '..')
IMG = os.path.join(ROOT, 'assets', 'img')


def load(name, ext='.png'):
    p = os.path.join(IMG, name + ext)
    return Image.open(p) if os.path.exists(p) else None


def tone(im, mul, add=(0, 0, 0)):
    """チャンネルごとに倍率と加算をかける（夜・異界の色調）"""
    r, g, b = im.convert('RGB').split()
    ch = [c.point(lambda v, m=m, a=a: max(0, min(255, int(v * m + a)))) for c, m, a in zip((r, g, b), mul, add)]
    return Image.merge('RGB', ch)


def eclipse(im, cx, cy, r):
    d = ImageDraw.Draw(im, 'RGBA')
    for i in range(14, 0, -1):
        d.ellipse((cx - r - i * 3, cy - r - i * 3, cx + r + i * 3, cy + r + i * 3), fill=(255, 200, 90, 10))
    d.ellipse((cx - r - 4, cy - r - 4, cx + r + 4, cy + r + 4), fill=(255, 226, 140, 255))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(8, 4, 14, 255))


def stars(im, n, area, seed):
    rnd = random.Random(seed)
    d = ImageDraw.Draw(im, 'RGBA')
    x0, y0, x1, y1 = area
    for _ in range(n):
        x, y = rnd.randint(x0, x1), rnd.randint(y0, y1)
        s = rnd.choice([1, 1, 1, 2])
        d.rectangle((x, y, x + s, y + s), fill=(255, 255, 255, rnd.randint(120, 255)))


def paste_sprite(im, name, cx, bottom, h, tint=None):
    sp = load(name)
    if sp is None:
        return
    sp = sp.convert('RGBA')
    k = h / sp.height
    sp = sp.resize((max(1, int(sp.width * k)), max(1, int(sp.height * k))), Image.LANCZOS)
    if tint:
        r, g, b, a = sp.split()
        rgb = tone(Image.merge('RGB', (r, g, b)), tint)
        sp = Image.merge('RGBA', (*rgb.split(), a))
    im.paste(sp, (int(cx - sp.width / 2), int(bottom - sp.height)), sp)


def make_reverse():
    base = load('bg_plains', '.jpg')
    if base is None:
        return None
    base = base.convert('RGB')
    im = tone(base, (0.6, 0.38, 0.9), (26, 8, 44))
    w, h = im.size
    # 空に、逆さまになった大地が浮かぶ（地面は下のまま）
    island = ImageOps.flip(tone(base.crop((0, int(h * 0.55), w, h)), (0.45, 0.3, 0.7), (20, 6, 36))).convert('RGBA')
    island.putalpha(Image.new('L', island.size, 150))
    sky = im.convert('RGBA')
    sky.alpha_composite(island, (0, 0))
    im = sky.convert('RGB')
    stars(im, 140, (0, int(h * 0.3), w, int(h * 0.55)), 3)
    return im


def make_grave():
    base = load('bg_snow', '.jpg')
    if base is None:
        return None
    im = tone(base, (0.32, 0.36, 0.58), (6, 8, 22))
    d = ImageDraw.Draw(im, 'RGBA')
    mx, my = int(im.width * 0.78), int(im.height * 0.16)
    for i in range(10, 0, -1):
        d.ellipse((mx - 40 - i * 4, my - 40 - i * 4, mx + 40 + i * 4, my + 40 + i * 4), fill=(220, 230, 255, 8))
    d.ellipse((mx - 40, my - 40, mx + 40, my + 40), fill=(236, 240, 220, 255))
    for i, x in enumerate(range(90, im.width, 170)):
        paste_sprite(im, 'obj_grave', x + (i % 2) * 30, im.height * (0.8 + (i % 3) * 0.05), 110 + (i % 3) * 20, (0.55, 0.6, 0.8))
    fog = Image.new('RGBA', im.size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(fog)
    for y in range(int(im.height * 0.55), im.height):
        a = int(90 * (y - im.height * 0.55) / (im.height * 0.45))
        fd.line([(0, y), (im.width, y)], fill=(170, 180, 220, a))
    im = Image.alpha_composite(im.convert('RGBA'), fog.filter(ImageFilter.GaussianBlur(6))).convert('RGB')
    return im


def make_tower():
    base = load('bg_volcano', '.jpg')
    if base is None:
        return None
    gray = ImageOps.grayscale(base)
    im = ImageOps.colorize(gray, black=(10, 4, 20), mid=(80, 36, 110), white=(240, 190, 255))
    eclipse(im, im.width // 2, int(im.height * 0.2), 70)
    stars(im, 90, (0, 0, im.width, int(im.height * 0.35)), 7)
    return im


def make_title():
    base = load('bg_plains', '.jpg')
    if base is None:
        return None
    im = tone(base.resize((1280, 853)), (0.22, 0.26, 0.5), (4, 6, 26)).crop((0, 26, 1280, 826))
    stars(im, 260, (0, 0, 1280, 380), 11)
    cx, cy = 640, 230
    eclipse(im, cx, cy, 92)
    for i in range(6):
        a = i / 6 * math.tau - math.pi / 2
        x, y = cx + math.cos(a) * 190, cy + math.sin(a) * 150
        d = ImageDraw.Draw(im, 'RGBA')
        for k in range(8, 0, -1):
            d.ellipse((x - 30 - k * 4, y - 30 - k * 4, x + 30 + k * 4, y + 30 + k * 4), fill=(255, 240, 200, 7))
        paste_sprite(im, 'orb%d' % (i + 1), x, y + 44, 88)
    # 手前の草原に立つ一行（影つき）
    d = ImageDraw.Draw(im, 'RGBA')
    for i, cls in enumerate(['warrior', 'knight', 'priest', 'mage']):
        x, y = 268 + i * 80, 730 + (i % 2) * 8
        d.ellipse((x - 34, y - 8, x + 34, y + 8), fill=(0, 0, 0, 110))
        paste_sprite(im, 'hero_' + cls, x, y + 2, 118, (0.72, 0.76, 0.95))
    return im


def make_rubble():
    """山道をふさぐ落石: AI生成の岩を3つ重ねる"""
    rock = load('obj_rock')
    if rock is None:
        return None
    im = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
    for x, y, s in ((6, 34, 52), (40, 26, 54), (22, 50, 46)):
        r = rock.convert('RGBA').resize((s, s), Image.LANCZOS)
        im.alpha_composite(r, (x, y))
    return im


def run(raw):
    rb = make_rubble()
    if rb is not None:
        rb.save(os.path.join(IMG, 'obj_rubble.png'))
        print('composed obj_rubble')
    jobs = [('bg_reverse', make_reverse, (960, 640)), ('bg_grave', make_grave, (960, 640)), ('bg_tower', make_tower, (960, 640)), ('title', make_title, (1280, 800))]
    for name, fn, size in jobs:
        if raw(name):
            continue
        im = fn()
        if im is None:
            continue
        im = im.convert('RGB').resize(size, Image.LANCZOS)
        im.save(os.path.join(IMG, name + '.jpg'), quality=86)
        print('composed', name)
