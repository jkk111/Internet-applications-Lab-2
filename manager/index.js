let lib = require('./lib.js');
let db = require('./db')

let express = require('express');
let app = express();
app.use(express.static('./static'))

app.get('/init', async(req, res) => {
  let repo = req.query.repo;
  let session = await lib.init(repo)
  res.send({ session })
})

app.get('/commits', async(req, res) => {
  let session = req.query.session;
  let commits = []
  try {
    commits = await lib.commits(session)
  } catch(e) {}
  res.send({ commits });
})

app.get('/analyze', async(req, res) => {
  let session = req.query.session;
  let commit = req.query.commit;
  let workers = req.query.workers;
  let ccn = await lib.analyze(session, commit, workers);
  res.send({ ccn });
});

app.get('/analyze_all', async(req, res) => {
  let session = req.query.session;
  let workers = req.query.workers;
  lib.analyze_all(session, workers);
  res.send("OK");
})

app.get('/lookup', async(req, res) => {
  let session = req.query.session;
  let data = await lib.lookup(session);
  res.send({ data });
});

app.listen(process.env.PORT || 80);