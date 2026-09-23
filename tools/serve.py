"""開発用サーバ（キャッシュ無効）。python tools/serve.py で http://127.0.0.1:8765/ を配信"""
import http.server, os, functools
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a):
        pass
http.server.ThreadingHTTPServer(('127.0.0.1', 8765), H).serve_forever()
