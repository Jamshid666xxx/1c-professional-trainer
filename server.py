import http.server
import socketserver
import os
import json
import urllib.parse
import webbrowser
import sys

DEFAULT_PORT = 8765
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
PROGRESS_FILE = os.path.join(DIRECTORY, "user_progress.json")

class TrainerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Prevent aggressive browser caching of app code and data
        if self.path.endswith(('.html', '.js', '.css', '.json')) or self.path == '/':
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/progress":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            if os.path.exists(PROGRESS_FILE):
                try:
                    with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
                        self.wfile.write(f.read().encode("utf-8"))
                    return
                except Exception as e:
                    print(f"Error reading progress file: {e}")
            
            default_data = {
                "mistakes": [],
                "starred": [],
                "history": [],
                "stats": {"answered": 0, "correct": 0},
                "questionStats": {}
            }
            self.wfile.write(json.dumps(default_data, ensure_ascii=False).encode("utf-8"))
            return
        elif parsed.path == "/" or parsed.path == "":
            self.path = "/index.html"
            
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/progress":
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode("utf-8"))
                with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(b'{"status": "ok"}')
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode("utf-8"))
            return
        self.send_response(404)
        self.end_headers()

def main():
    os.chdir(DIRECTORY)
    socketserver.TCPServer.allow_reuse_address = True
    
    port = DEFAULT_PORT
    httpd = None
    for try_port in range(DEFAULT_PORT, DEFAULT_PORT + 10):
        try:
            httpd = socketserver.TCPServer(("", try_port), TrainerHandler)
            port = try_port
            break
        except OSError:
            continue
            
    if httpd is None:
        print("Ошибка: Не удалось найти свободный порт для сервера.")
        sys.exit(1)

    url = f"http://localhost:{port}"
    print("=" * 62)
    print("   Тренажер «1С:Профессионал (Платформа 8.3)» успешно запущен!")
    print(f"   Локальный адрес: {url}")
    print("=" * 62)
    print("   Нажмите Ctrl+C для остановки сервера.")
    print("-" * 62)
    
    webbrowser.open(url)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nОстановка сервера...")
    finally:
        httpd.server_close()

if __name__ == "__main__":
    main()
