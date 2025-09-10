#!/usr/bin/env python3

import time
import logging
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading
import sys
import json

PORT = 80
TIMEOUT_MINUTES = 5  # Auto shutdown after x minutes
ALLOWED_FILES = {'/', '/index.html', '/shapes.js', '/images/mainmenu.png', '/styles.css', "/favicon.ico", "/auto.html" }

# Setup logging to console and file
logger = logging.getLogger('RestrictedHTTPServer')
logger.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s %(levelname)s: %(message)s')

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

file_handler = logging.FileHandler('server.log')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

LOGFILE = 'browser_logs.txt'

class RestrictedHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path in ALLOWED_FILES:
            logger.info(f"Serving allowed file: {self.path} from {self.client_address[0]}")
            super().do_GET()
        else:
            logger.warning(f"Blocked access to: {self.path} from {self.client_address[0]}")
            self.send_error(404, "File not found")

    def do_POST(self):
        if self.path == '/log':
            content_length = int(self.headers.get('Content-Length', 0))
            raw_data = self.rfile.read(content_length)
            try:
                data = json.loads(raw_data.decode('utf-8'))
                log_entry = f"{time.strftime('%Y-%m-%d %H:%M:%S')} [{self.client_address[0]}] {data.get('level','INFO').upper()}: {data.get('message','')}\n"
                # Optionally, include extra details
                if 'extra' in data:
                    log_entry += f"      Extra: {json.dumps(data['extra'])}\n"
                with open(LOGFILE, 'a') as f:
                    f.write(log_entry)
                logger.info(f"Received browser log: {log_entry.strip()}")
                self.send_response(200)
            except Exception as e:
                logger.error(f"Failed to parse browser log: {e}")
                self.send_error(400, "Bad log data")
            self.end_headers()
        else:
            self.send_error(404, "Not found")

    def list_directory(self, path):
        self.send_error(403, "Directory listing not allowed")
        return None

    def end_headers(self):
        # Only add cache-control headers for allowed files (static assets)
        if self.path in ALLOWED_FILES:
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        super().end_headers()

def run_server():
    server_address = ('0.0.0.0', PORT)
    httpd = HTTPServer(server_address, RestrictedHandler)

    def shutdown_server_after_timeout():
        logger.info(f"Server will auto-shutdown after {TIMEOUT_MINUTES} minutes.")
        time.sleep(TIMEOUT_MINUTES * 60)
        logger.info("Timeout reached, shutting down server...")
        httpd.shutdown()

    threading.Thread(target=shutdown_server_after_timeout, daemon=True).start()

    logger.info(f"Serving HTTP on port {PORT} with restricted files only.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Server stopped by user.")

if __name__ == "__main__":
    if not sys.platform.startswith('linux') and not sys.platform.startswith('darwin'):
        logger.warning("Warning: Running on non-Unix OS; binding to port 80 may require additional permissions.")
    run_server()

