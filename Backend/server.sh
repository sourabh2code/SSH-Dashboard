
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime
from pathlib import Path
import threading
import time

# Configuration
PORT = 8000
REPORT_DIR = Path(__file__).resolve().parent / "reports"
RETENTION_HOURS = 24
CLEANUP_INTERVAL = 3600  # 1 hour

REPORT_DIR.mkdir(parents=True, exist_ok=True)

latest_reports = {}
lock = threading.Lock()


def save_report(data):
    now = datetime.now()

    # Create a separate log file for each hour
    filename = now.strftime("report_%Y%m%d_%H.log")
    filepath = REPORT_DIR / filename

    with lock:
        with open(filepath, "a") as f:
            f.write(f"[{now:%Y-%m-%d %H:%M:%S}] {data}\n")

        # Extract hostname
        host = "unknown"

        for field in data.split():
            if field.startswith("host="):
                host = field.split("=", 1)[1]
                break

        # Update latest report for each machine
        latest_reports[host] = data

        # Save the latest reports
        with open(REPORT_DIR / "latest.txt", "w") as f:
            for report in latest_reports.values():
                f.write(report + "\n")


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
