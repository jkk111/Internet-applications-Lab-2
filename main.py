from flask import Flask, request
from subprocess import run
import lizard

app = Flask(__name__)

@app.route('/')
def index():
    return 'hello'

@app.route('/repo/<path>', methods=['GET'])
def analyze_repo(path=''):
  if path == '':
    return 0
  run('git clone {} ./repo'.format(path))
  return 'n/a'

@app.route('/analyze', methods=['POST'])
def analyze_file():
  print(request.files)
  return 'n/a'

if __name__ == '__main__':
    app.run(debug=True, port=8888)

