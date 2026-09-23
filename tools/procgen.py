"""AI生成画像が無いアセットを、ローカルでドット絵として手続き生成する（代替アセット）。
現在は gpt-image-2 のシートに含めていない 渡し舟・柵・泉 と、AI画像が欠けたときの保険として使う。
既に assets/img に存在するファイルは上書きしない（AI生成版を優先）。
低解像度で描画 → 自動アウトライン → 最近傍拡大 でドット絵らしく仕上げる。
"""
import os, math, random
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'img')
os.makedirs(OUT, exist_ok=True)
FORCE = os.environ.get('PROCGEN_FORCE') == '1'


def exists(name, ext='.png'):
    return (not FORCE) and os.path.exists(os.path.join(OUT, name + ext))


def C(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def mul(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + (c[3] if len(c) > 3 else 255,)


class Pix:
    def __init__(self, n):
        self.n = n
        self.im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def ell(self, x0, y0, x1, y1, c, shade=True):
        self.d.ellipse((x0, y0, x1, y1), fill=c)
        if shade and x1 - x0 > 4:
            # 右下に影、左上にハイライト
            w, h = x1 - x0, y1 - y0
            self.d.chord((x0, y0, x1, y1), 20, 160, fill=mul(c, 0.75))
            self.d.ellipse((x0 + w * 0.12, y0 + h * 0.12, x0 + w * 0.62, y0 + h * 0.55), fill=c)
            self.d.ellipse((x0 + w * 0.2, y0 + h * 0.15, x0 + w * 0.36, y0 + h * 0.3), fill=mul(c, 1.35))

    def rect(self, x0, y0, x1, y1, c):
        self.d.rectangle((x0, y0, x1, y1), fill=c)

    def poly(self, pts, c):
        self.d.polygon(pts, fill=c)

    def line(self, pts, c, w=1):
        self.d.line(pts, fill=c, width=w)

    def px(self, x, y, c):
        if 0 <= x < self.n and 0 <= y < self.n:
            self.im.putpixel((int(x), int(y)), c)

    def eyes(self, cx, cy, gap, c=(255, 255, 255, 255), pupil=(20, 20, 30, 255), size=2):
        for dx in (-gap, gap):
            self.d.rectangle((cx + dx - size // 2, cy - size // 2, cx + dx + size - 1 - size // 2, cy + size - 1 - size // 2), fill=c)
            self.px(cx + dx, cy, pupil)

    def finish(self, size, outline=(20, 14, 24, 255)):
        im = self.im
        n = self.n
        src = im.load()
        out = im.copy()
        o = out.load()
        for y in range(n):
            for x in range(n):
                if src[x, y][3] == 0:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < n and 0 <= yy < n and src[xx, yy][3] > 0:
                            o[x, y] = outline
                            break
        return out.resize((size, size), Image.NEAREST)


def save(img, name, ext='.png', **kw):
    img.save(os.path.join(OUT, name + ext), **kw)
    print('procgen', name)


# ---------------------------------------------------------------- 敵アーキタイプ
N = 48


def blob(col, eyecol=None, drip=False, crown=False):
    p = Pix(N)
    p.ell(6, 16, 42, 44, col)
    p.line([(24, 16), (24, 9)], C('3a8a3a'), 2)
    p.ell(24, 5, 32, 11, C('5ac05a'), shade=False)
    p.ell(12, 20, 20, 26, mul(col, 1.4), shade=False)
    p.eyes(24, 31, 5, size=3)
    p.line([(20, 37), (24, 39), (28, 37)], (40, 20, 30, 255))
    if drip:
        for x in (12, 22, 34):
            p.rect(x, 40, x + 2, 45, mul(col, 0.8))
    if crown:
        p.poly([(17, 12), (19, 6), (22, 10), (24, 4), (26, 10), (29, 6), (31, 12)], C('ffd23f'))
    return p


def quad(body, kind='wolf', accent=None, eye=(255, 230, 80, 255)):
    p = Pix(N)
    accent = accent or mul(body, 0.7)
    if kind == 'toad':
        p.ell(6, 16, 42, 44, body)
        p.ell(10, 30, 38, 44, mul(body, 1.25), shade=False)
        p.ell(9, 10, 19, 20, body)
        p.ell(29, 10, 39, 20, body)
        p.eyes(24, 15, 10, c=C('ffe070'), size=4)
        p.line([(12, 30), (24, 34), (36, 30)], (40, 20, 20, 255), 1)
        for x, y in ((12, 20), (30, 22), (20, 26), (35, 34)):
            p.ell(x, y, x + 3, y + 3, accent, shade=False)
        return p
    # 胴体
    p.ell(10, 20, 38, 38, body)
    for x in (12, 18, 30, 35):
        p.rect(x, 34, x + 3, 44, mul(body, 0.8))
    # 尾
    if kind == 'lizard':
        p.line([(10, 30), (4, 24), (4, 16)], body, 3)
        p.poly([(1, 16), (4, 6), (8, 14)], C('ff8a2a'))
        p.poly([(3, 16), (4, 10), (6, 15)], C('ffe24a'))
    elif kind == 'rat':
        p.line([(10, 32), (4, 36), (2, 44)], C('d49a8a'), 1)
        for i in range(5):
            x = 14 + i * 5
            p.poly([(x, 22), (x + 2, 12 + (i % 2) * 2), (x + 4, 22)], accent)
    else:
        p.poly([(11, 26), (2, 18), (6, 30)], body)
    # 頭
    p.ell(28, 12, 46, 30, body)
    p.poly([(40, 22), (47, 24), (40, 28)], mul(body, 0.9))
    if kind in ('wolf', 'rat'):
        p.poly([(30, 14), (32, 4), (36, 13)], body)
        p.poly([(38, 13), (42, 4), (44, 15)], body)
    p.px(37, 18, eye); p.px(38, 18, eye); p.px(41, 18, eye); p.px(42, 18, eye)
    p.px(38, 18, (10, 10, 10, 255)); p.px(42, 18, (10, 10, 10, 255))
    if kind == 'wolf':
        p.poly([(40, 26), (41, 30), (42, 26)], (255, 255, 255, 255))
        p.poly([(44, 26), (45, 29), (46, 26)], (255, 255, 255, 255))
        p.ell(14, 18, 30, 26, accent, shade=False)
    return p


def flyer(body, kind='bird', accent=None):
    p = Pix(N)
    accent = accent or mul(body, 0.7)
    if kind == 'bat':
        p.poly([(24, 20), (2, 10), (6, 18), (2, 26), (10, 24), (14, 30), (22, 28)], accent)
        p.poly([(24, 20), (46, 10), (42, 18), (46, 26), (38, 24), (34, 30), (26, 28)], accent)
        p.ell(16, 16, 32, 34, body)
        p.poly([(17, 18), (18, 8), (22, 16)], body)
        p.poly([(31, 18), (30, 8), (26, 16)], body)
        p.eyes(24, 23, 4, c=C('ff4040'), size=2)
        p.poly([(21, 29), (22, 32), (23, 29)], (255, 255, 255, 255))
        p.poly([(25, 29), (26, 32), (27, 29)], (255, 255, 255, 255))
    elif kind == 'moth':
        for sx in (-1, 1):
            p.ell(24 + sx * 2 - (22 if sx < 0 else 0), 6, 24 + sx * 2 + (22 if sx > 0 else 0), 26, body)
            p.ell(24 + sx * 4 - (14 if sx < 0 else 0), 24, 24 + sx * 4 + (14 if sx > 0 else 0), 40, mul(body, 0.9))
            p.ell(24 + sx * 12 - 3, 13, 24 + sx * 12 + 3, 19, accent, shade=False)
        p.rect(22, 10, 26, 40, mul(body, 0.55))
        p.line([(23, 10), (18, 3)], accent); p.line([(25, 10), (30, 3)], accent)
        p.eyes(24, 13, 2, c=C('ffffff'), size=1)
    elif kind == 'owl':
        p.poly([(10, 18), (2, 36), (12, 34)], accent)
        p.poly([(38, 18), (46, 36), (36, 34)], accent)
        p.ell(10, 10, 38, 44, body)
        p.ell(15, 26, 33, 42, mul(body, 1.3), shade=False)
        p.ell(12, 12, 23, 23, C('e8e0c0'), shade=False)
        p.ell(25, 12, 36, 23, C('e8e0c0'), shade=False)
        p.ell(15, 15, 20, 20, C('ff9020'), shade=False)
        p.ell(28, 15, 33, 20, C('ff9020'), shade=False)
        p.poly([(22, 22), (24, 27), (26, 22)], C('e0a020'))
        for y in (30, 34, 38):
            p.line([(17, y), (31, y)], mul(body, 0.7))
        p.rect(22, 4, 26, 10, C('a08040'))
    else:  # bird
        p.poly([(16, 24), (0, 14), (6, 28)], accent)
        p.poly([(32, 24), (48, 14), (42, 28)], accent)
        p.ell(12, 16, 36, 40, body)
        p.ell(16, 26, 32, 40, C('f0a040'), shade=False)
        p.poly([(22, 22), (24, 32), (26, 22)], C('ffb020'))
        p.eyes(24, 20, 5, c=C('ffffff'), size=3)
        p.rect(18, 40, 20, 46, C('ffa030')); p.rect(28, 40, 30, 46, C('ffa030'))
        p.poly([(20, 16), (22, 8), (26, 16)], body)
    return p


def humanoid(skin, cloth, kind='mummy', accent=None):
    p = Pix(N)
    accent = accent or mul(cloth, 0.7)
    if kind in ('wraith', 'ghost'):
        p.poly([(12, 16), (36, 16), (42, 46), (34, 40), (28, 46), (20, 40), (14, 46), (6, 46)], cloth)
        p.ell(12, 4, 36, 28, cloth)
        p.ell(16, 10, 32, 26, (10, 6, 16, 255), shade=False)
        p.eyes(24, 17, 4, c=C('7af0ff'), size=2)
        p.poly([(6, 26), (2, 36), (10, 32)], skin); p.poly([(42, 26), (46, 36), (38, 32)], skin)
        return p
    if kind == 'snowman':
        p.ell(8, 24, 40, 47, (240, 246, 255, 255))
        p.ell(13, 8, 35, 30, (240, 246, 255, 255))
        p.poly([(12, 12), (24, 0), (36, 12)], C('7a8aa0'))
        p.eyes(24, 19, 4, c=(20, 20, 30, 255), size=2)
        p.poly([(24, 21), (31, 23), (24, 24)], C('ff8a20'))
        p.line([(40, 44), (44, 4)], C('7a5a3a'), 2)
        p.poly([(41, 6), (44, 0), (47, 6)], C('c0c8d0'))
        p.rect(14, 28, 34, 31, C('d03030'))
        return p
    if kind == 'twins':
        for ox, c in ((-9, cloth), (9, accent)):
            p.poly([(18 + ox, 18), (30 + ox, 18), (34 + ox, 46), (14 + ox, 46)], c)
            p.ell(16 + ox, 8, 32 + ox, 24, c)
            p.eyes(24 + ox, 16, 3, c=C('ffe060'), size=2)
        p.rect(20, 30, 28, 32, mul(cloth, 1.2))
        return p
    # 通常人型
    p.rect(17, 36, 21, 46, mul(cloth, 0.8)); p.rect(27, 36, 31, 46, mul(cloth, 0.8))
    p.ell(13, 18, 35, 40, cloth)
    p.rect(8, 22, 13, 34, skin if kind != 'armor' else cloth)
    p.rect(35, 22, 40, 34, skin if kind != 'armor' else cloth)
    p.ell(14, 4, 34, 22, skin)
    if kind == 'mummy':
        for y in range(6, 44, 4):
            p.line([(12, y), (36, y + 2)], mul(skin, 0.8))
        p.eyes(24, 12, 4, c=C('ffe040'), size=2)
    elif kind == 'skeleton':
        p.rect(18, 20, 30, 36, (0, 0, 0, 0))
        for y in (22, 26, 30):
            p.line([(17, y), (31, y)], skin)
        p.rect(23, 20, 25, 36, skin)
        p.ell(18, 9, 22, 14, (20, 10, 10, 255), shade=False); p.ell(26, 9, 30, 14, (20, 10, 10, 255), shade=False)
        p.px(20, 11, C('ff4040')); p.px(28, 11, C('ff4040'))
        p.line([(40, 34), (46, 12)], C('a0a0a8'), 2)
        p.ell(2, 24, 12, 38, C('7a5030'))
    elif kind == 'ogre':
        p.poly([(15, 8), (13, 0), (19, 6)], C('f0e8d0')); p.poly([(33, 8), (35, 0), (29, 6)], C('f0e8d0'))
        p.eyes(24, 12, 4, c=C('ffff60'), size=2)
        p.rect(19, 17, 29, 19, (40, 10, 10, 255))
        p.px(20, 17, (255, 255, 255, 255)); p.px(28, 17, (255, 255, 255, 255))
        p.line([(42, 36), (46, 10)], C('6a4a2a'), 4)
        p.rect(14, 30, 34, 33, C('ffd040'))
    elif kind == 'fishman':
        p.poly([(24, 0), (18, 8), (30, 8)], accent)
        p.eyes(24, 12, 5, c=C('ffffff'), size=3)
        p.line([(19, 18), (29, 18)], (20, 30, 40, 255))
        p.poly([(10, 10), (14, 4), (14, 14)], accent); p.poly([(38, 10), (34, 4), (34, 14)], accent)
        p.line([(42, 44), (42, 4)], C('c0a060'), 1)
        p.poly([(39, 6), (42, 0), (45, 6)], C('d0d8e0'))
    elif kind == 'witch':
        p.poly([(10, 10), (38, 10), (26, 0), (30, -2)], accent)
        p.rect(8, 9, 40, 11, accent)
        p.eyes(24, 14, 4, c=C('9ff0ff'), size=2)
        p.poly([(13, 40), (35, 40), (40, 47), (8, 47)], cloth)
        p.line([(40, 46), (42, 14)], C('a0d0ff'), 2)
        p.ell(38, 8, 46, 16, C('bff0ff'))
    elif kind == 'armor':
        p.rect(14, 4, 34, 20, cloth)
        p.rect(16, 11, 32, 13, (10, 10, 14, 255))
        p.px(20, 12, C('ff5050')); p.px(28, 12, C('ff5050'))
        p.poly([(24, 0), (20, 4), (28, 4)], accent)
        p.line([(42, 46), (42, 8)], C('b0b8c8'), 3)
        p.ell(0, 20, 12, 40, accent)
    elif kind == 'angel':
        # 逆さまの天使（上下反転して返す）
        p.poly([(12, 24), (0, 8), (2, 30)], (40, 30, 50, 255)); p.poly([(36, 24), (48, 8), (46, 30)], (40, 30, 50, 255))
        p.eyes(24, 13, 4, c=C('ffffff'), size=2)
        p.ell(16, 0, 32, 4, C('ffe070'), shade=False)
        p.im = p.im.transpose(Image.FLIP_TOP_BOTTOM)
        p.d = ImageDraw.Draw(p.im)
    else:
        p.eyes(24, 12, 4, size=2)
    return p


def serpent(body, belly, fins=None):
    p = Pix(N)
    for i in range(40):
        t = i / 39
        y = 44 - t * 30
        x = 24 + math.sin(t * 7) * 12 * (1 - t * 0.5)
        r = 6 - t * 1.5
        p.ell(x - r, y - r, x + r, y + r, body, shade=False)
        if i % 5 == 0:
            p.px(x, y + 2, belly)
    p.ell(24, 6, 44, 22, body)
    if fins:
        p.poly([(26, 8), (28, 0), (32, 7)], fins); p.poly([(34, 7), (38, 0), (40, 9)], fins)
    p.eyes(34, 13, 4, c=C('ffe040'), size=2)
    p.poly([(38, 20), (44, 26), (40, 20)], (255, 60, 60, 255))
    return p


def arthropod(body, kind='scorpion'):
    p = Pix(N)
    if kind == 'crab':
        p.ell(8, 20, 40, 40, body)
        for x in (6, 10, 36, 40):
            p.line([(x, 34), (x - 4 if x < 24 else x + 4, 44)], mul(body, 0.8), 2)
        p.ell(0, 6, 14, 20, body); p.ell(34, 6, 48, 20, body)
        p.poly([(4, 6), (7, 12), (10, 6)], (0, 0, 0, 0)); p.poly([(38, 6), (41, 12), (44, 6)], (0, 0, 0, 0))
        p.line([(18, 22), (16, 14)], body, 1); p.line([(30, 22), (32, 14)], body, 1)
        p.ell(14, 11, 18, 15, (255, 255, 255, 255), shade=False); p.ell(30, 11, 34, 15, (255, 255, 255, 255), shade=False)
        p.px(16, 13, (0, 0, 0, 255)); p.px(32, 13, (0, 0, 0, 255))
        return p
    p.ell(12, 26, 36, 42, body)
    for i in range(3):
        p.line([(14, 34 + i * 3), (4, 38 + i * 4)], mul(body, 0.8), 1)
        p.line([(34, 34 + i * 3), (44, 38 + i * 4)], mul(body, 0.8), 1)
    seg = [(24, 28), (24, 20), (28, 13), (33, 8), (38, 6)]
    for x, y in seg:
        p.ell(x - 4, y - 4, x + 4, y + 4, body, shade=False)
    p.poly([(38, 2), (44, 6), (38, 10)], C('c0ff60'))
    p.ell(2, 22, 12, 30, body); p.ell(36, 22, 46, 30, body)
    p.eyes(24, 30, 3, c=C('ff4040'), size=2)
    return p


def mushroom(cap, stem=(240, 228, 200, 255)):
    p = Pix(N)
    p.ell(14, 26, 34, 46, stem)
    p.ell(4, 6, 44, 32, cap)
    for x, y in ((12, 12), (26, 9), (34, 18), (18, 20)):
        p.ell(x, y, x + 5, y + 4, (255, 250, 240, 255), shade=False)
    p.eyes(24, 36, 4, c=(30, 20, 20, 255), size=2)
    p.line([(21, 41), (27, 41)], (80, 30, 30, 255))
    for x, y in ((6, 34), (40, 30), (8, 44), (42, 42)):
        p.px(x, y, C('fff080'))
    return p


def caterpillar(body, spot):
    p = Pix(N)
    for i in range(5):
        x = 6 + i * 7
        y = 32 - (6 if i == 2 else 0)
        p.ell(x, y, x + 12, y + 12, body)
        p.ell(x + 4, y + 2, x + 8, y + 6, spot, shade=False)
    p.ell(32, 14, 46, 30, body)
    p.eyes(39, 21, 3, c=(255, 255, 255, 255), size=2)
    p.line([(36, 14), (34, 8)], mul(body, 0.6)); p.line([(42, 14), (44, 8)], mul(body, 0.6))
    return p


def golem(body, core=None, spikes=False):
    p = Pix(N)
    p.rect(14, 36, 20, 46, mul(body, 0.8)); p.rect(28, 36, 34, 46, mul(body, 0.8))
    p.ell(10, 16, 38, 40, body)
    p.ell(2, 18, 14, 36, body); p.ell(34, 18, 46, 36, body)
    p.ell(16, 4, 32, 20, body)
    p.eyes(24, 12, 4, c=C('ffe050') if not core else C('ffffff'), size=2)
    if core:
        p.poly([(24, 22), (30, 28), (24, 34), (18, 28)], core)
        p.poly([(24, 24), (27, 28), (24, 30)], (255, 255, 255, 255))
    if spikes:
        for x in (12, 20, 30, 38):
            p.poly([(x - 3, 20), (x, 10), (x + 3, 20)], mul(body, 1.2))
    for x, y in ((14, 24), (30, 30), (22, 36)):
        p.line([(x, y), (x + 4, y + 2)], mul(body, 0.6))
    return p


def wisp(col, inner, kind='flame'):
    p = Pix(N)
    if kind == 'wind':
        for r, c in ((20, col), (14, inner), (8, col)):
            p.d.arc((24 - r, 24 - r, 24 + r, 24 + r), 30, 330, fill=c, width=4)
        p.ell(16, 14, 32, 30, inner)
        p.eyes(24, 21, 4, c=(255, 255, 255, 255), size=2)
        p.line([(20, 26), (24, 28), (28, 26)], (30, 60, 30, 255))
        return p
    if kind == 'water':
        p.poly([(24, 2), (8, 30), (12, 44), (36, 44), (40, 30)], col)
        p.ell(8, 18, 40, 46, col)
        p.ell(14, 24, 34, 40, inner, shade=False)
        p.eyes(24, 28, 5, c=(255, 255, 255, 255), size=3)
        p.poly([(4, 30), (0, 20), (10, 26)], col); p.poly([(44, 30), (48, 20), (38, 26)], col)
        return p
    p.poly([(24, 0), (10, 22), (14, 44), (34, 44), (38, 22), (30, 10), (28, 18)], col)
    p.ell(10, 20, 38, 46, col)
    p.poly([(24, 14), (16, 30), (20, 42), (30, 42), (32, 30)], inner)
    p.eyes(24, 32, 4, c=(255, 255, 255, 255), size=2)
    return p


def eyeball(col, iris):
    p = Pix(N)
    for i, x in enumerate((10, 18, 30, 38)):
        p.line([(x, 34), (x + (i - 1.5) * 3, 46)], mul(col, 0.7), 2)
    p.ell(6, 4, 42, 40, (240, 232, 232, 255))
    for x, y in ((10, 16), (36, 12), (12, 30), (34, 32)):
        p.line([(x, y), (x + 4, y + 2)], C('d04040'))
    p.ell(14, 12, 34, 32, iris)
    p.ell(20, 18, 28, 26, (10, 10, 10, 255), shade=False)
    p.px(21, 19, (255, 255, 255, 255))
    return p


def mimic(col):
    p = Pix(N)
    p.rect(6, 22, 42, 44, col)
    p.poly([(6, 22), (10, 6), (38, 6), (42, 22)], mul(col, 1.1))
    p.rect(6, 20, 42, 26, (40, 10, 10, 255))
    for x in range(8, 42, 5):
        p.poly([(x, 20), (x + 2, 25), (x + 4, 20)], (255, 255, 240, 255))
        p.poly([(x, 26), (x + 2, 22), (x + 4, 26)], (255, 255, 240, 255))
    p.rect(22, 28, 26, 34, C('ffe040'))
    p.eyes(24, 13, 8, c=C('ff3030'), size=3)
    for x in (6, 40):
        p.rect(x, 22, x + 2, 44, C('d0a030'))
    p.poly([(26, 24), (30, 36), (34, 30)], C('ff6080'))
    return p


def dragon(body, belly, wings, horn=True):
    p = Pix(N)
    p.poly([(16, 18), (0, 4), (2, 20), (0, 30), (14, 28)], wings)
    p.poly([(32, 18), (48, 4), (46, 20), (48, 30), (34, 28)], wings)
    p.line([(30, 40), (44, 44), (46, 38)], body, 3)
    p.ell(12, 18, 36, 44, body)
    p.ell(17, 24, 31, 42, belly, shade=False)
    p.ell(16, 4, 32, 20, body)
    if horn:
        p.poly([(22, 6), (24, -2), (26, 6)], C('f0e8c0'))
    p.poly([(17, 6), (14, 0), (20, 5)], C('f0e8c0')); p.poly([(31, 6), (34, 0), (28, 5)], C('f0e8c0'))
    p.eyes(24, 11, 4, c=C('ffd020'), size=2)
    p.rect(20, 16, 28, 18, (40, 10, 10, 255))
    return p


def chimera():
    p = Pix(N)
    q = dragon(C('2a2050'), C('4a3a80'), C('1a1438'), horn=False)
    p.im = q.im
    p.d = ImageDraw.Draw(p.im)
    for x, y in ((14, 26), (30, 30), (22, 36), (26, 24), (18, 40)):
        p.px(x, y, (255, 255, 255, 255))
    p.ell(0, 22, 12, 34, C('c0a040'))
    p.eyes(6, 27, 2, c=C('ff3030'), size=1)
    p.ell(36, 22, 48, 34, C('604080'))
    p.eyes(42, 27, 2, c=C('60ffff'), size=1)
    return p


ENEMY_ART = {
    'e1_0': lambda: blob(C('3a8cff')),
    'e1_1': lambda: quad(C('8a6a4a'), 'rat', C('5a3a2a')),
    'e1_2': lambda: flyer(C('3a3040'), 'bird', C('2a2030')),
    'e1_3': lambda: mushroom(C('d83a3a')),
    'e1_4': lambda: caterpillar(C('6ac04a'), C('a040c0')),
    'e1_5': lambda: flyer(C('6a4a8a'), 'bat', C('4a2a6a')),
    'e1_6': lambda: golem(C('9a8a7a')),
    'e1_7': lambda: serpent(C('d8b060'), C('f0e0a0')),
    'e1_8': lambda: arthropod(C('3a3848'), 'scorpion'),
    'e2_0': lambda: humanoid(C('e8dcc0'), C('d8ccb0'), 'mummy'),
    'e2_1': lambda: wisp(C('7ae08a'), C('c0ffc8'), 'wind'),
    'e2_2': lambda: arthropod(C('d84a3a'), 'crab'),
    'e2_3': lambda: dragon(C('8a8a90'), C('a8a8b0'), C('6a6a74'), horn=False),
    'e2_4': lambda: wisp(C('3a7aff'), C('a0e0ff')),
    'e2_5': lambda: humanoid(C('4ab0a0'), C('3a7a90'), 'fishman', C('2a8a70')),
    'e2_6': lambda: wisp(C('7ae8f0'), C('d8fcff'), 'water'),
    'e2_7': lambda: quad(C('7a9a3a'), 'toad', C('4a6a2a')),
    'e2_8': lambda: quad(C('e0502a'), 'lizard', C('a03020')),
    'e3_0': lambda: blob(C('ff7a2a'), drip=True),
    'e3_1': lambda: humanoid(C('d84a3a'), C('7a4a2a'), 'ogre'),
    'e3_2': lambda: wisp(C('3a90e0'), C('a0d8ff'), 'water'),
    'e3_3': lambda: quad(C('e8eef8'), 'wolf', C('b0c0d8'), eye=C('60c0ff')),
    'e3_4': lambda: humanoid(C('e0f0ff'), C('7ab0e0'), 'witch', C('3a5a9a')),
    'e3_5': lambda: humanoid(C('ffffff'), C('ffffff'), 'snowman'),
    'e3_6': lambda: flyer(C('a8e0ff'), 'moth', C('ffffff')),
    'e3_7': lambda: humanoid(C('e8e4d8'), C('8a8070'), 'skeleton'),
    'e3_8': lambda: humanoid(C('b0a0d0'), C('4a3a6a'), 'wraith'),
    'e4_0': lambda: humanoid(C('8a90a0'), C('7a8090'), 'armor', C('4a5060')),
    'e4_1': lambda: dragon(C('3a2a4a'), C('5a4a6a'), C('2a1a3a'), horn=True),
    'e4_2': lambda: dragon(C('2a3a4a'), C('5a6a7a'), C('1a2a3a')),
    'e4_3': lambda: eyeball(C('a04060'), C('c03030')),
    'e4_4': lambda: humanoid(C('f0e0e0'), C('e8e0f0'), 'angel', C('a090c0')),
    'e4_5': lambda: humanoid(C('000000'), C('2a1a3a'), 'twins', C('3a2a5a')),
    'e4_6': chimera,
    'e4_7': lambda: mimic(C('c08a3a')),
    'e4_8': lambda: flyer(C('b08a4a'), 'owl', C('7a5a2a')),
}


def boss(fn, extra=None):
    p = fn()
    if extra:
        extra(p)
    return p


def crown(p, x=24, y=2):
    p.poly([(x - 7, y + 6), (x - 6, y), (x - 3, y + 4), (x, y - 2), (x + 3, y + 4), (x + 6, y), (x + 7, y + 6)], C('ffd23f'))
    p.px(x, y + 3, C('ff3050'))


def b_wolf():
    p = quad(C('4a6a3a'), 'wolf', C('2a4a2a'), eye=C('80ff60'))
    for x, y in ((14, 22), (20, 28), (26, 20), (32, 30)):
        p.line([(x, y), (x + 3, y + 3)], C('7ac05a'), 1)
    return p


def b_scorpion():
    p = arthropod(C('d8a830'), 'scorpion')
    crown(p, 24, 16)
    return p


def b_serpent():
    return serpent(C('2a8a8a'), C('a0f0e0'), fins=C('50c0d0'))


def b_dragon():
    p = dragon(C('2a1e1e'), C('ff7a2a'), C('4a1a1a'))
    for x, y in ((16, 30), (28, 34), (22, 26)):
        p.line([(x, y), (x + 3, y + 5)], C('ffa030'), 1)
    return p


def b_prism():
    p = golem(C('b8e8f8'), core=C('ff60c0'), spikes=True)
    for i, c in enumerate(('ff5050', 'ffe050', '50ff80', '50a0ff')):
        p.px(21 + i * 2, 36, C(c))
    return p


def b_knight():
    p = humanoid(C('2a2a34'), C('24242e'), 'armor', C('5a3a7a'))
    p.poly([(12, 18), (4, 46), (18, 40)], C('5a2a7a'))
    p.poly([(36, 18), (44, 46), (30, 40)], C('5a2a7a'))
    p.px(20, 12, C('60d0ff')); p.px(28, 12, C('60d0ff'))
    return p


def b_yomi1():
    p = Pix(N)
    p.poly([(12, 16), (0, 2), (2, 24), (0, 40), (12, 34)], C('141018'))
    p.poly([(36, 16), (48, 2), (46, 24), (48, 40), (36, 34)], C('141018'))
    p.poly([(14, 18), (34, 18), (40, 47), (8, 47)], C('1e1a2a'))
    p.rect(22, 18, 26, 47, C('d0a030'))
    p.ell(15, 2, 33, 20, C('242030'))
    p.poly([(30, 10), (42, 14), (30, 16)], C('d0a030'))
    p.eyes(22, 9, 3, c=C('ff3030'), size=2)
    p.line([(6, 46), (6, 6)], C('8a6a3a'), 2)
    p.ell(1, 0, 11, 10, (10, 6, 14, 255), shade=False)
    p.d.arc((0, -1, 12, 11), 0, 360, fill=C('ffd060'))
    return p


def b_yomi2():
    p = Pix(N)
    p.d.ellipse((4, 0, 44, 40), outline=C('ffd060'), width=2)
    p.ell(8, 4, 40, 36, (10, 6, 14, 255), shade=False)
    p.poly([(16, 20), (0, 6), (0, 40), (14, 34)], C('1a1428'))
    p.poly([(32, 20), (48, 6), (48, 40), (34, 34)], C('1a1428'))
    for x, y in ((3, 14), (5, 30), (44, 12), (45, 28), (2, 22), (46, 20)):
        p.px(x, y, (255, 255, 255, 255))
    p.ell(12, 16, 36, 46, C('241c30'))
    p.ell(16, 8, 32, 24, C('241c30'))
    p.poly([(30, 14), (42, 18), (30, 21)], C('c09a30'))
    for x in (20, 24, 28):
        p.px(x, 14, C('ff3050'))
    p.px(24, 12, C('ff3050'))
    return p


def b_amnes():
    p = Pix(N)
    p.poly([(14, 16), (34, 16), (42, 47), (6, 47)], C('e8e4ec'))
    p.poly([(18, 16), (30, 16), (34, 47), (14, 47)], C('24202c'))
    p.ell(15, 2, 33, 20, (8, 6, 12, 255), shade=False)
    crown(p, 24, 0)
    p.px(21, 11, C('d0d0ff')); p.px(27, 11, C('d0d0ff'))
    p.rect(6, 22, 12, 30, C('f0ecf4')); p.rect(36, 22, 42, 30, C('f0ecf4'))
    for x, y in ((2, 6), (44, 8), (4, 38), (44, 36)):
        p.rect(x, y, x + 3, y + 5, C('6a6070'))
        p.px(x + 1, y - 1, C('4a4050'))
    return p


BOSS_ART = {'b_wolf': b_wolf, 'b_scorpion': b_scorpion, 'b_serpent': b_serpent, 'b_dragon': b_dragon, 'b_prism': b_prism,
            'b_knight': b_knight, 'b_yomi1': b_yomi1, 'b_yomi2': b_yomi2, 'b_amnes': b_amnes}


# ---------------------------------------------------------------- マップオブジェクト（32x32）
def obj_art():
    A = {}
    M = 32

    def P():
        return Pix(M)

    def tree():
        p = P(); p.rect(14, 22, 18, 31, C('6a4a2a')); p.ell(4, 2, 28, 26, C('2e9a3a'))
        p.ell(8, 6, 16, 12, C('5ad05a'), shade=False); return p
    A['obj_tree'] = tree

    def pine():
        p = P(); p.rect(14, 24, 18, 31, C('5a3a2a'))
        for i, y in enumerate((2, 9, 16)):
            p.poly([(16, y), (5 - i * 2, y + 12), (27 + i * 2, y + 12)], C('1e6a3a'))
            p.poly([(16, y), (11 - i, y + 5), (21 + i, y + 5)], C('f0f8ff'))
        return p
    A['obj_pine'] = pine

    def mountain():
        p = P(); p.poly([(16, 2), (0, 30), (32, 30)], C('8a6a4a')); p.poly([(16, 2), (16, 30), (32, 30)], C('6a4a34'))
        p.poly([(16, 2), (11, 11), (21, 11)], C('f4f4ff')); return p
    A['obj_mountain'] = mountain

    def rock():
        p = P(); p.ell(3, 6, 29, 30, C('8a8a92')); p.line([(10, 14), (14, 18)], C('5a5a62')); return p
    A['obj_rock'] = rock

    def chest(open_=False):
        def f():
            p = P()
            p.rect(4, 12, 28, 28, C('9a5a2a'))
            if open_:
                p.rect(4, 6, 28, 12, C('5a2a10')); p.rect(6, 12, 26, 16, (20, 10, 5, 255))
            else:
                p.poly([(4, 12), (6, 5), (26, 5), (28, 12)], C('b06a30'))
            p.rect(4, 12, 28, 13, C('ffd040')); p.rect(14, 12, 18, 18, C('ffd040'))
            p.rect(4, 12, 5, 28, C('ffd040')); p.rect(27, 12, 28, 28, C('ffd040'))
            return p
        return f
    A['obj_chest'] = chest(); A['obj_chest_open'] = chest(True)

    def stairs(down):
        def f():
            p = P()
            p.rect(3, 3, 29, 29, C('5a5a66'))
            for i in range(5):
                c = mul(C('b0b0bc'), (1 - i * 0.16) if down else (0.5 + i * 0.12))
                p.rect(5, 5 + i * 5, 27, 8 + i * 5, c)
            return p
        return f
    A['obj_stairs_down'] = stairs(True); A['obj_stairs_up'] = stairs(False)

    def door():
        p = P(); p.rect(4, 2, 28, 31, C('6a6a74')); p.rect(8, 6, 24, 31, C('9a5a2a'))
        p.line([(16, 6), (16, 31)], C('6a3a1a')); p.px(20, 18, C('ffd040')); return p
    A['obj_door'] = door

    def irondoor():
        p = P(); p.rect(2, 2, 30, 31, C('4a4a54'))
        for x in range(5, 29, 5):
            p.rect(x, 3, x + 2, 31, C('9aa0b0'))
        p.rect(2, 8, 30, 10, C('9aa0b0')); p.rect(13, 14, 19, 21, C('ffd040')); p.px(16, 17, (0, 0, 0, 255)); return p
    A['obj_irondoor'] = irondoor

    def gate():
        p = P()
        for x in range(3, 30, 5):
            p.rect(x, 1, x + 2, 31, C('a0a8b8'))
        p.rect(1, 6, 31, 8, C('7a8090')); p.rect(1, 24, 31, 26, C('7a8090')); return p
    A['obj_gate'] = gate

    def switch(on):
        def f():
            p = P(); p.ell(4, 8, 28, 28, C('7a7a86'))
            p.ell(10, 12 if not on else 15, 22, 22 if not on else 24, C('ff4040') if not on else C('40ff70')); return p
        return f
    A['obj_switch'] = switch(False); A['obj_switch_on'] = switch(True)

    def town():
        p = P()
        for x, y, c in ((2, 12, 'c04030'), (16, 8, '3060c0'), (9, 18, 'c08030')):
            p.rect(x + 1, y + 6, x + 13, y + 13, C('f0e0c0'))
            p.poly([(x, y + 7), (x + 7, y), (x + 14, y + 7)], C(c))
            p.rect(x + 6, y + 9, x + 8, y + 13, C('6a3a1a'))
        return p
    A['obj_town'] = town

    def cave():
        p = P(); p.poly([(16, 2), (0, 30), (32, 30)], C('7a6a5a')); p.ell(9, 14, 23, 34, (10, 6, 6, 255), shade=False); return p
    A['obj_cave'] = cave

    def tower():
        p = P(); p.rect(10, 6, 22, 31, C('c8b890')); p.rect(8, 2, 24, 7, C('a89870'))
        for x in (8, 13, 18, 23):
            p.rect(x, 0, x + 1, 2, C('a89870'))
        p.rect(14, 12, 17, 16, (20, 20, 30, 255)); p.rect(13, 24, 18, 31, C('5a3a1a')); return p
    A['obj_tower'] = tower

    def castle():
        p = P(); p.rect(4, 12, 28, 31, C('3a3048')); p.rect(12, 2, 20, 31, C('4a3a5a'))
        p.poly([(11, 3), (16, -2), (21, 3)], C('8a5ad0'))
        p.rect(14, 22, 18, 31, (10, 6, 16, 255)); p.px(16, 8, C('d080ff')); return p
    A['obj_castle'] = castle

    def fence():
        p = P()
        for x in (3, 14, 25):
            p.rect(x, 8, x + 3, 28, C('a07040'))
        p.rect(0, 12, 31, 14, C('8a5a30')); p.rect(0, 21, 31, 23, C('8a5a30')); return p
    A['obj_fence'] = fence

    def flowers():
        p = P(); p.rect(2, 18, 30, 30, C('6a4a2a'))
        rnd = random.Random(4)
        for i in range(10):
            x, y = rnd.randint(4, 26), rnd.randint(10, 24)
            p.rect(x, y + 2, x, y + 6, C('3a9a3a'))
            p.ell(x - 2, y - 2, x + 2, y + 2, C(rnd.choice(['ff5080', 'ffe040', 'ffffff', 'a060ff'])), shade=False)
        return p
    A['obj_flowers'] = flowers

    def counter():
        p = P(); p.rect(0, 8, 31, 26, C('9a6a3a')); p.rect(0, 8, 31, 12, C('c08a4a')); p.line([(0, 18), (31, 18)], C('7a4a2a')); return p
    A['obj_counter'] = counter

    def bed():
        p = P(); p.rect(5, 2, 27, 30, C('8a5a30')); p.rect(7, 4, 25, 12, (250, 250, 255, 255)); p.rect(7, 12, 25, 28, C('3a6ad0')); return p
    A['obj_bed'] = bed

    def well():
        p = P(); p.ell(3, 10, 29, 30, C('8a8a92')); p.ell(8, 14, 24, 26, C('2a4a8a'), shade=False)
        p.rect(4, 2, 6, 18, C('6a4a2a')); p.rect(26, 2, 28, 18, C('6a4a2a')); p.rect(3, 1, 29, 4, C('9a3a2a')); return p
    A['obj_well'] = well

    def sign():
        p = P(); p.rect(14, 16, 18, 31, C('6a4a2a')); p.rect(4, 4, 28, 18, C('b08a50'))
        for y in (8, 12):
            p.line([(8, y), (24, y)], C('5a3a1a'))
        return p
    A['obj_sign'] = sign

    def crystal():
        p = P()
        for x, h, c in ((8, 20, '60c0ff'), (16, 28, '90e0ff'), (23, 16, '50a0f0')):
            p.poly([(x, 31 - h), (x - 5, 31 - h // 2), (x, 31), (x + 5, 31 - h // 2)], C(c))
        return p
    A['obj_crystal'] = crystal

    def altar():
        p = P(); p.rect(6, 14, 26, 30, C('a8a8b8')); p.rect(3, 10, 29, 15, C('c8c8d8')); p.rect(3, 28, 29, 31, C('8a8a9a'))
        p.ell(12, 3, 20, 11, C('ffe890')); return p
    A['obj_altar'] = altar

    def statue():
        p = P(); p.rect(6, 24, 26, 31, C('8a8a92')); p.ell(10, 8, 22, 26, C('a8a8b0')); p.ell(11, 0, 21, 10, C('a8a8b0'))
        p.poly([(10, 12), (2, 4), (8, 18)], C('9a9aa2')); p.poly([(22, 12), (30, 4), (24, 18)], C('9a9aa2')); return p
    A['obj_statue'] = statue

    def brazier():
        p = P(); p.rect(14, 16, 18, 31, C('4a4a54')); p.poly([(6, 14), (26, 14), (22, 20), (10, 20)], C('6a6a74'))
        p.poly([(16, 0), (8, 14), (24, 14)], C('ff8020')); p.poly([(16, 5), (12, 14), (20, 14)], C('ffe040')); return p
    A['obj_brazier'] = brazier

    def barrel():
        p = P(); p.ell(6, 4, 26, 30, C('9a6a3a')); p.rect(6, 10, 26, 12, C('5a5a60')); p.rect(6, 22, 26, 24, C('5a5a60')); return p
    A['obj_barrel'] = barrel

    def shelf():
        p = P(); p.rect(2, 0, 30, 31, C('6a4a2a'))
        rnd = random.Random(7)
        for y in (3, 13, 23):
            x = 4
            while x < 27:
                w = rnd.randint(2, 3)
                p.rect(x, y, x + w - 1, y + 7, C(rnd.choice(['c03030', '3050c0', '30a050', 'd0a030', '8040a0'])))
                x += w + 1
        return p
    A['obj_bookshelf'] = shelf

    def portal():
        p = P()
        for r, c in ((14, '4a1a8a'), (11, '8a3ad0'), (8, 'c070ff'), (4, 'f0d0ff')):
            p.ell(16 - r, 16 - r, 16 + r, 16 + r, C(c), shade=False)
        return p
    A['obj_portal'] = portal

    def cactus():
        p = P(); p.rect(13, 4, 19, 31, C('3a9a4a')); p.rect(5, 10, 9, 20, C('3a9a4a')); p.rect(5, 18, 13, 21, C('3a9a4a'))
        p.rect(23, 6, 27, 16, C('3a9a4a')); p.rect(19, 14, 27, 17, C('3a9a4a')); p.line([(15, 6), (15, 30)], C('6ad07a')); return p
    A['obj_cactus'] = cactus

    def palm():
        p = P(); p.line([(16, 31), (18, 10)], C('9a6a3a'), 3)
        for dx, dy in ((-14, 4), (14, 4), (-10, -6), (10, -6), (0, -8)):
            p.line([(18, 10), (18 + dx, 10 + dy)], C('2e9a3a'), 3)
        return p
    A['obj_palm'] = palm

    def grave():
        p = P(); p.rect(8, 8, 24, 30, C('8a8a92')); p.ell(8, 2, 24, 16, C('8a8a92'), shade=False)
        p.rect(15, 8, 17, 20, C('5a5a62')); p.rect(11, 11, 21, 13, C('5a5a62')); return p
    A['obj_grave'] = grave

    def spring():
        p = P(); p.ell(2, 6, 30, 28, C('8a8a92')); p.ell(6, 9, 26, 25, C('50c0ff'), shade=False); p.ell(10, 12, 16, 16, C('d0f8ff'), shade=False); return p
    A['obj_spring'] = spring

    def boat():
        p = P(); p.poly([(2, 18), (30, 18), (26, 28), (6, 28)], C('8a5a2a')); p.rect(15, 2, 16, 18, C('6a4a2a'))
        p.poly([(17, 3), (28, 15), (17, 15)], (250, 250, 250, 255)); return p
    A['obj_boat'] = boat

    def rubble():
        p = P()
        for x, y, r in ((4, 14, 9), (14, 8, 10), (18, 18, 9), (6, 22, 7)):
            p.ell(x, y, x + r * 1.4, y + r, C('8a7a6a'))
        return p
    A['obj_rubble'] = rubble

    return A


# ---------------------------------------------------------------- 背景（240x160 → 960x640）
def grad(d, w, h, top, bot, y0=0, y1=None):
    y1 = y1 or h
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0 - 1)
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)


def bg_image(kind):
    w, h = 240, 160
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    rnd = random.Random(hash(kind) & 0xffff)
    if kind == 'bg_plains':
        grad(d, w, h, (90, 160, 240), (190, 225, 255), 0, 100)
        for x, y in ((30, 20), (150, 30), (200, 12)):
            d.ellipse((x, y, x + 36, y + 12), fill=(250, 250, 255)); d.ellipse((x + 10, y - 6, x + 30, y + 8), fill=(250, 250, 255))
        d.ellipse((-40, 80, 120, 150), fill=(90, 170, 80)); d.ellipse((90, 76, 290, 160), fill=(70, 150, 70))
        grad(d, w, h, (100, 190, 80), (60, 130, 50), 108, 160)
    elif kind == 'bg_cave':
        grad(d, w, h, (30, 24, 20), (60, 50, 36), 0, 160)
        for x in range(0, w, 14):
            d.polygon([(x, 0), (x + 7, rnd.randint(14, 40)), (x + 14, 0)], fill=(50, 40, 30))
        grad(d, w, h, (70, 60, 40), (40, 34, 24), 110, 160)
        for i in range(12):
            x, y = rnd.randint(0, w), rnd.randint(100, 150)
            d.ellipse((x, y, x + 5, y + 3), fill=(120, 230, 140))
    elif kind == 'bg_desert':
        grad(d, w, h, (250, 170, 90), (255, 230, 170), 0, 100)
        d.ellipse((180, 16, 206, 42), fill=(255, 250, 210))
        d.rectangle((40, 60, 52, 100), fill=(200, 160, 110)); d.rectangle((37, 56, 55, 62), fill=(180, 140, 90))
        d.ellipse((-60, 86, 150, 170), fill=(230, 180, 100)); d.ellipse((80, 92, 320, 180), fill=(215, 160, 85))
    elif kind == 'bg_temple':
        grad(d, w, h, (20, 60, 110), (10, 30, 60), 0, 160)
        for x in (20, 70, 160, 210):
            d.rectangle((x, 20, x + 16, 120), fill=(60, 110, 150)); d.rectangle((x - 3, 16, x + 19, 22), fill=(80, 130, 170))
        for i in range(6):
            x = rnd.randint(0, w)
            d.polygon([(x, 0), (x + 10, 0), (x + 40, 160), (x + 24, 160)], fill=(30, 80, 130))
        grad(d, w, h, (40, 90, 120), (20, 50, 80), 120, 160)
        for i in range(20):
            x, y = rnd.randint(0, w), rnd.randint(0, 150)
            d.ellipse((x, y, x + 3, y + 3), outline=(160, 220, 255))
    elif kind == 'bg_volcano':
        grad(d, w, h, (120, 20, 20), (240, 110, 40), 0, 110)
        d.polygon([(60, 110), (120, 30), (180, 110)], fill=(50, 30, 30)); d.polygon([(110, 30), (120, 40), (130, 30)], fill=(255, 140, 40))
        grad(d, w, h, (60, 36, 30), (30, 20, 20), 110, 160)
        for i in range(4):
            y = 120 + i * 9
            d.line([(0, y), (w, y + rnd.randint(-6, 6))], fill=(255, 110, 30), width=2)
    elif kind == 'bg_snow':
        grad(d, w, h, (180, 210, 240), (235, 245, 255), 0, 110)
        for x in range(0, w, 22):
            y = rnd.randint(64, 84)
            d.polygon([(x + 11, y), (x, y + 30), (x + 22, y + 30)], fill=(40, 90, 70)); d.polygon([(x + 11, y), (x + 6, y + 10), (x + 16, y + 10)], fill=(255, 255, 255))
        grad(d, w, h, (240, 248, 255), (200, 220, 240), 108, 160)
    elif kind == 'bg_grave':
        grad(d, w, h, (20, 20, 50), (60, 60, 100), 0, 110)
        d.ellipse((190, 14, 214, 38), fill=(240, 240, 210))
        d.rectangle((40, 50, 90, 110), fill=(40, 40, 60)); d.polygon([(36, 52), (65, 20), (94, 52)], fill=(50, 50, 70))
        grad(d, w, h, (50, 60, 60), (30, 36, 40), 108, 160)
        for x in range(10, w, 26):
            d.rectangle((x, 100 + rnd.randint(0, 20), x + 10, 140), fill=(110, 110, 120))
    elif kind == 'bg_tower':
        grad(d, w, h, (20, 10, 30), (80, 40, 90), 0, 110)
        d.ellipse((96, 14, 144, 62), fill=(255, 210, 110)); d.ellipse((99, 17, 141, 59), fill=(8, 4, 12))
        for i in range(8):
            x, y = rnd.randint(-40, w), rnd.randint(70, 110)
            d.ellipse((x, y, x + 70, y + 16), fill=(60, 40, 70))
        grad(d, w, h, (50, 40, 60), (26, 20, 34), 112, 160)
    elif kind == 'bg_reverse':
        grad(d, w, h, (40, 10, 70), (120, 60, 160), 0, 160)
        for i in range(50):
            d.point((rnd.randint(0, w), rnd.randint(0, h)), fill=(255, 255, 255))
        for x, y in ((30, 30), (140, 20), (190, 60)):
            d.polygon([(x, y), (x + 40, y), (x + 20, y + 26)], fill=(70, 40, 90)); d.rectangle((x, y - 4, x + 40, y), fill=(90, 150, 90))
        for i in range(8):
            x, y = rnd.randint(0, w), rnd.randint(60, 120)
            d.rectangle((x, y, x + 4, y + 7), fill=(90, 80, 100))
        grad(d, w, h, (60, 30, 80), (30, 14, 44), 120, 160)
    else:  # dungeon
        grad(d, w, h, (40, 40, 50), (20, 20, 26), 0, 160)
        for x in (30, 110, 190):
            d.rectangle((x, 10, x + 20, 130), fill=(70, 70, 82))
            d.ellipse((x + 6, 40, x + 14, 52), fill=(255, 160, 50))
        grad(d, w, h, (60, 60, 70), (30, 30, 36), 120, 160)
    return im.resize((960, 640), Image.NEAREST)


def title_image():
    w, h = 320, 200
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    grad(d, w, h, (8, 10, 40), (60, 40, 100), 0, 200)
    rnd = random.Random(11)
    for i in range(120):
        d.point((rnd.randint(0, w), rnd.randint(0, 140)), fill=(255, 255, 255) if i % 3 else (255, 230, 160))
    d.ellipse((130, 20, 190, 80), fill=(255, 220, 120)); d.ellipse((134, 24, 186, 76), fill=(10, 6, 20))
    cols = [(90, 230, 110), (255, 210, 60), (80, 160, 255), (255, 80, 60), (255, 255, 255), (180, 110, 255)]
    for i, c in enumerate(cols):
        a = i / 6 * math.tau - math.pi / 2
        x, y = 160 + math.cos(a) * 52, 50 + math.sin(a) * 36
        for r in (7, 5, 3):
            cc = tuple(int(v * (0.5 + (7 - r) * 0.12)) for v in c)
            d.ellipse((x - r, y - r, x + r, y + r), fill=cc if r != 3 else c)
    d.polygon([(0, 200), (0, 140), (60, 130), (120, 150), (150, 200)], fill=(20, 16, 30))
    d.polygon([(150, 200), (200, 160), (320, 150), (320, 200)], fill=(30, 26, 44))
    d.rectangle((250, 110, 262, 160), fill=(220, 220, 230)); d.rectangle((248, 104, 264, 112), fill=(200, 60, 60))
    d.polygon([(256, 108), (320, 90), (320, 126)], fill=(255, 240, 160))
    # 主人公のシルエット
    d.rectangle((88, 112, 96, 132), fill=(10, 8, 16)); d.ellipse((86, 104, 98, 116), fill=(10, 8, 16))
    d.line([(96, 118), (104, 110)], fill=(10, 8, 16), width=2)
    d.ellipse((101, 104, 109, 112), fill=(255, 220, 120))
    return im.resize((1280, 800), Image.NEAREST)


if __name__ == '__main__':
    for k, fn in ENEMY_ART.items():
        if not exists(k):
            save(fn().finish(160), k)
    for k, fn in BOSS_ART.items():
        if not exists(k):
            save(fn().finish(320), k)
    for k, fn in obj_art().items():
        if not exists(k):
            save(fn().finish(96), k)
    for bg in ['bg_plains', 'bg_cave', 'bg_desert', 'bg_temple', 'bg_volcano', 'bg_snow', 'bg_grave', 'bg_tower', 'bg_reverse']:
        if not exists(bg, '.jpg'):
            save(bg_image(bg), bg, '.jpg', quality=88)
    if not exists('title', '.jpg'):
        save(title_image(), 'title', '.jpg', quality=88)
