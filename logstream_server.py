import os
from flask import Flask, request, abort

app = Flask(__name__)

LOGSTREAM_TOKEN = os.environ.get("LOGSTREAM_SECRET")
LOGSTREAM_TOKEN_CHECK = os.environ.get("LOGSTREAM_TOKEN_CHECK", "1")
LOG_FILE = os.environ.get("LOGSTREAM_FILE", "/tmp/client_logs.txt")

def token_check_enabled():
    return str(LOGSTREAM_TOKEN_CHECK).strip().lower() not in ("0", "no", "false", "")

@app.route('/logstream', methods=['POST'])
def logstream():
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
    with open(LOG_FILE, 'a') as f:
        f.write(log_line + "\n")

    return '', 204

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)

