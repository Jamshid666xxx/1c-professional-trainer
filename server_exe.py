"""
server_exe.py — версия для сборки в .exe через PyInstaller.

Статические файлы (index.html, styles.css, app.js) бандлятся внутрь exe.
Данные (dataset.json, images/, Новая папка/) должны лежать рядом с .exe.
Прогресс сохраняется рядом с .exe в user_progress.json.
"""
import http.server
import socketserver
import os
import sys
import json
import urllib.parse
import webbrowser
import threading
import posixpath

DEFAULT_PORT = 8765

# ── Определение путей ───────────────────────────────────────────────────
def resource_path(relative):
    """Путь к статическим ресурсам (index.html, css, js), бандлятся в exe."""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative)

def data_path(relative=''):
    """Путь к данным, которые лежат рядом с .exe (или рядом со скриптом)."""
    if getattr(sys, 'frozen', False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, relative) if relative else base

STATIC_DIR  = resource_path('static_web')  # index.html / css / js (внутри exe)
DATA_DIR    = data_path()                   # dataset.json, images/, Новая папка/
PROGRESS_FILE = data_path('user_progress.json')


# ── HTTP Handler ─────────────────────────────────────────────────────────
class TrainerHandler(http.server.BaseHTTPRequestHandler):

    # ---- Helpers -----------------------------------------------------------
    def send_file(self, filepath, content_type=None):
        try:
            with open(filepath, 'rb') as f:
                data = f.read()
            if content_type is None:
                content_type = self._guess_type(filepath)
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self._no_cache()
            self.end_headers()
            self.wfile.write(data)
        except FileNotFoundError:
            self.send_error(404, 'File not found: ' + filepath)

    def send_json(self, obj):
        body = json.dumps(obj, ensure_ascii=False, indent=2).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self._no_cache()
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, code, msg):
        body = json.dumps({'error': msg}).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(body)

    def _no_cache(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')

    @staticmethod
    def _guess_type(path):
        ext = os.path.splitext(path)[1].lower()
        return {
            '.html': 'text/html; charset=utf-8',
            '.css':  'text/css; charset=utf-8',
            '.js':   'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png':  'image/png',
            '.jpg':  'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.ico':  'image/x-icon',
            '.svg':  'image/svg+xml',
        }.get(ext, 'application/octet-stream')

    # ---- Routing -----------------------------------------------------------
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        url_path = urllib.parse.unquote(parsed.path)

        # API
        if url_path == '/api/progress':
            self._handle_get_progress()
            return

        # Root
        if url_path in ('/', ''):
            url_path = '/index.html'

        # Static web files (bundled inside exe)
        web_candidates = ['index.html', 'styles.css', 'app.js']
        fname = url_path.lstrip('/')
        if fname in web_candidates:
            self.send_file(os.path.join(STATIC_DIR, fname))
            return

        # Data files (next to exe): dataset.json, images/, Новая папка/
        local = self._safe_data_path(url_path)
        if local and os.path.isfile(local):
            self.send_file(local)
            return

        self.send_error(404, 'Not Found')

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if urllib.parse.unquote(parsed.path) == '/api/progress':
            self._handle_post_progress()
            return
        self.send_error(404, 'Not Found')

    def _safe_data_path(self, url_path):
        """Convert URL path → absolute local path, preventing path traversal."""
        # Remove leading slash, normalize separators
        rel = url_path.lstrip('/')
        # Join with data dir
        candidate = os.path.normpath(os.path.join(DATA_DIR, rel))
        # Security: must stay inside DATA_DIR
        if not candidate.startswith(DATA_DIR):
            return None
        return candidate

    def _handle_get_progress(self):
        if os.path.exists(PROGRESS_FILE):
            try:
                with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self.send_json(data)
                return
            except Exception:
                pass
        self.send_json({
            'mistakes': [], 'starred': [], 'history': [],
            'stats': {'answered': 0, 'correct': 0}, 'questionStats': {}
        })

    def _handle_post_progress(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            raw = self.rfile.read(length)
            data = json.loads(raw.decode('utf-8'))
            with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self.send_json({'status': 'ok'})
        except Exception as e:
            self.send_error_json(500, str(e))

    def log_message(self, fmt, *args):
        # Suppress request logs (clean console)
        pass


# ── Entry Point ──────────────────────────────────────────────────────────
def main():
    port = DEFAULT_PORT
    httpd = None
    for try_port in range(DEFAULT_PORT, DEFAULT_PORT + 20):
        try:
            socketserver.TCPServer.allow_reuse_address = True
            httpd = socketserver.TCPServer(('', try_port), TrainerHandler)
            port = try_port
            break
        except OSError:
            continue

    if httpd is None:
        print('Ошибка: не удалось найти свободный порт.')
        input('Нажмите Enter для выхода...')
        sys.exit(1)

    url = f'http://localhost:{port}'
    print('=' * 60)
    print('  Тренажер «1С:Профессионал (Платформа 8.3)»')
    print(f'  Адрес: {url}')
    print('=' * 60)
    print('  Закройте это окно, чтобы остановить сервер.')
    print('-' * 60)

    # Open browser in a thread (tiny delay lets the socket bind)
    threading.Timer(0.7, lambda: webbrowser.open(url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()

if __name__ == '__main__':
    main()
