from flask import Flask, request, jsonify
from subprocess import run
from io import BytesIO
import os
import lizard

import logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)

@app.route('/analyze', methods=['POST'])
def analyze_file():
  files = request.files.getlist('files')
  read = {}

  for file in files:
    name = file.filename
    try:
      s = file.stream.read().decode('utf-8')
      analysis = lizard.analyze_file.analyze_source_code(name, s)
      read[name] = analysis.average_cyclomatic_complexity
    except:
      read[name] = 0
  return jsonify(read)

if __name__ == '__main__':
  port = int(os.environ['PORT'])
  app.run(port=port, debug=True, host='0.0.0.0')

