
from http.server import HTTPServer, BaseHTTPRequestHandler
import re
from pathlib import Path
import threading
import time

# Configuration
PORT = 8000
REPORT_DIR = Path(__file__).resolve().parent / "reports"
RETENTION_HOURS = 24
CLEANUP_INTERVAL = 3600  # 1 hour

REPORT_DIR.mkdir(parents=True, exist_ok=True)

lock = threading.Lock()



def rebuild_latest():
    with open(REPORT_DIR / "latest.txt", "w") as f:
        for filepath in sorted(REPORT_DIR.glob("machine_*.txt")):
            f.write(filepath.read_text())


def save_report(data):
    fields = dict(field.split("=", 1) for field in data.split())
    host = fields["host"]

    # Use safe hostnames as filenames
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,62}", host):
        raise ValueError("Invalid hostname")

    filepath = REPORT_DIR / f"machine_{host}.txt"

    with lock:
        filepath.write_text(data + "\n")
        rebuild_latest()


def cleanup_old_logs():
    while True:
        cutoff = time.time() - RETENTION_HOURS * 3600

        with lock:
            for filepath in REPORT_DIR.glob("report_*.log"):
                try:
                    if filepath.stat().st_mtime < cutoff:
                        filepath.unlink()
                        print("Deleted:", filepath, flush=True)
                except FileNotFoundError:
                    pass

        time.sleep(CLEANUP_INTERVAL)


class Handler(BaseHTTPRequestHandler):

    def do_POST(self):
        if self.path != "/report":
            self.send_error(404)
            return

        try:
            size = int(self.headers.get("Content-Length", "0"))

            if size <= 0 or size > 4096:
                self.send_error(400)
                return

            data = self.rfile.read(size).decode("utf-8")

            save_report(data)

            print("Received:", data, flush=True)

            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")

        except (ValueError, UnicodeError):
            self.send_error(400)


def main():
    # Start background log cleanup
    cleanup_thread = threading.Thread(
        target=cleanup_old_logs,
        daemon=True
    )
    cleanup_thread.start()

    server = HTTPServer(("0.0.0.0", PORT), Handler)

    print(f"Monitoring server running on port {PORT}")
    print(f"Reports directory: {REPORT_DIR}")
    print(f"Log retention: {RETENTION_HOURS} hours")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping monitoring server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
