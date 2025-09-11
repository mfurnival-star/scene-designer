from flask import Flask, request
import json

app = Flask(__name__)

@app.route('/logstream', methods=['POST'])
def logstream():
    data = request.get_json(force=True)
    with open('/tmp/client_logs.txt', 'a') as f:
        f.write(json.dumps(data) + "\n")
    return '', 204

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001)

