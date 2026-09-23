"""assets/img 内の画像から
- assets/manifest.js : 画像一覧（http配信時は Assets.load でファイルを直接読む）
- assets/bundle.js   : data URI 埋め込み版（file:// で開いた時の読み込み用。WebGLの画像汚染対策）
を生成する。"""
import os, base64, json

ROOT = os.path.join(os.path.dirname(__file__), '..')
IMG = os.path.join(ROOT, 'assets', 'img')
names = sorted(f for f in os.listdir(IMG) if f.endswith(('.png', '.jpg')))
manifest = [{'alias': os.path.splitext(f)[0], 'src': 'assets/img/' + f} for f in names]
with open(os.path.join(ROOT, 'assets', 'manifest.js'), 'w', encoding='utf-8') as fp:
    fp.write('// 自動生成: tools/build_bundle.py\nwindow.ASSET_MANIFEST = ' + json.dumps(manifest, ensure_ascii=False) + ';\n')
parts = []
for f in names:
    mime = 'image/png' if f.endswith('.png') else 'image/jpeg'
    with open(os.path.join(IMG, f), 'rb') as fp:
        b = base64.b64encode(fp.read()).decode('ascii')
    parts.append('"%s":"data:%s;base64,%s"' % (os.path.splitext(f)[0], mime, b))
with open(os.path.join(ROOT, 'assets', 'bundle.js'), 'w', encoding='utf-8') as fp:
    fp.write('// 自動生成: tools/build_bundle.py（file:// 起動用の埋め込み画像）\nwindow.ASSET_BUNDLE = {' + ','.join(parts) + '};\n')
print(len(names), 'assets', os.path.getsize(os.path.join(ROOT, 'assets', 'bundle.js')) // 1024, 'KB')
