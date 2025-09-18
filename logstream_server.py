import os
from flask import Flask, request, abort
from flask_cors import CORS  # <-- Add this line

app = Flask(__name__)
CORS(app)  # <-- Add this line

# Load environment variables at the top
LOGSTREAM_TOKEN = os.environ.get("LOGSTREAM_SECRET")
LOGSTREAM_TOKEN_CHECK = os.environ.get("LOGSTREAM_TOKEN_CHECK", "1")
LOG_FILE = os.environ.get("LOGSTREAM_FILE", "/tmp/client_logs.txt")

def token_check_enabled():
    return str(LOGSTREAM_TOKEN_CHECK).strip().lower() not in ("0", "no", "false", "")

@app.route('/logstream', methods=['POST'])
def logstream():
    print("Received POST /logstream")  # Debug print

    # Only enforce Bearer token if enabled and token is set
    if token_check_enabled() and LOGSTREAM_TOKEN:
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            abort(401, "Missing Bearer token")
        token = auth.split(" ", 1)[1]
        if token != LOGSTREAM_TOKEN:
            abort(401, "Invalid Bearer token")

    try:
        data = request.get_json(force=True)
    except Exception:
        abort(400, "Invalid JSON")

    log_line = (
        f"{data.get('timestamp', '')} [{data.get('level', 'INFO')}] "
        f"{data.get('message', '')} | page={data.get('page', '')} | agent={data.get('userAgent', '')}"
    )
    try:
        with open(LOG_FILE, 'a') as f:
            f.write(log_line + "\n")
    except Exception as e:
        print(f"Error writing to log file: {e}")
        abort(500, "Failed to write log")

    return '', 204

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
