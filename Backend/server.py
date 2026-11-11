import json
from http.server import HTTPServer, BaseHTTPRequestHandler
import re
from pathlib import Path
import threading
import time

# Configuration
PORT = 8000
REPORT_DIR = Path(__file__).resolve().parent / "reports"
RETENTION_SECONDS = 300  # 5 minutes
CLEANUP_INTERVAL = 30    # Check every 30 seconds
MAX_REPORT_AGE = 60      # Reject reports older than 60 seconds
FUTURE_TOLERANCE = 30    # Allow 30 seconds of clock difference

REPORT_DIR.mkdir(parents=True, exist_ok=True)

lock = threading.Lock()



def rebuild_latest():
    with open(REPORT_DIR / "latest.txt", "w") as f:
        for filepath in sorted(REPORT_DIR.glob("machine_*.txt")):
            f.write(filepath.read_text())



def save_report(data):
    fields = dict(field.split("=", 1) for field in data.split())
    host = fields["host"]
    timestamp = int(fields["timestamp"])
    now = time.time()

    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,62}", host):
        raise ValueError("Invalid hostname")

    if not (now - MAX_REPORT_AGE <= timestamp <= now + FUTURE_TOLERANCE):
        raise ValueError("Stale or future timestamp")

    filepath = REPORT_DIR / f"machine_{host}.txt"

    with lock:
        if filepath.exists():
            old_data = filepath.read_text()
            old_fields = dict(
                field.split("=", 1) for field in old_data.split()
            )
            if timestamp <= int(old_fields.get("timestamp", 0)):
                raise ValueError("Duplicate or older report")

        filepath.write_text(data + "\n")
        rebuild_latest()



def cleanup_stale_machines():
    while True:
        cutoff = time.time() - RETENTION_SECONDS

        with lock:
            for filepath in REPORT_DIR.glob("machine_*.txt"):
                try:
                    if filepath.stat().st_mtime < cutoff:
                        filepath.unlink()
                        print("Removed offline machine:", filepath.name, flush=True)
                except FileNotFoundError:
                    pass

            rebuild_latest()

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

    
    def do_GET(self):
        if self.path != "/api/machines":
            self.send_error(404)
            return

        machines = []
        now = time.time()

        with lock:
            for filepath in sorted(REPORT_DIR.glob("machine_*.txt")):
                try:
                    age = now - filepath.stat().st_mtime

                    # Ignore reports older than 5 minutes
                    if age > 300:
                        continue

                    data = filepath.read_text().strip()
                    fields = dict(
                        item.split("=", 1) for item in data.split()
                    )

                    machines.append({
                        "host": fields["host"],
                        "cpu": float(fields["cpu"]),
                        "mem": float(fields["mem"]),
                        "ram_total_mb": int(fields["ram_total_mb"]),
                        "ram_available_mb": int(fields["ram_available_mb"]),
                        "ssh_sessions": int(fields["ssh_sessions"]),
                        "timestamp": int(fields["timestamp"]),
                        "last_seen_seconds": round(age),
                        "online": age <= 90
                    })

                except (ValueError, KeyError, OSError):
                    continue

        response = json.dumps(machines).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(response)))

        # Allow the local frontend development server
        allowed_origins = {
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "http://localhost:5173",
            "http://127.0.0.1:5173"
        }
        origin = self.headers.get("Origin")
        if origin in allowed_origins:
            self.send_header("Access-Control-Allow-Origin", origin)

        self.end_headers()
        self.wfile.write(response)



def main():
    # Start background log cleanup
    cleanup_thread = threading.Thread(
        target=cleanup_stale_machines,
        daemon=True
    )
    cleanup_thread.start()

    server = HTTPServer(("0.0.0.0", PORT), Handler)

    print(f"Monitoring server running on port {PORT}")
    print(f"Reports directory: {REPORT_DIR}")
    print(f"Machine report retention: {RETENTION_SECONDS} seconds")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping monitoring server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
