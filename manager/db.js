let sql = require('sqlite3').verbose();
let db = new sql.Database('./data.sql');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS results (
    session TEXT,
    hash TEXT,
    value INT,
    nodes INT,
    time INT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS session (
    id TEXT,
    repo TEXT
  )`);
})

let create_session = (session, repo) => {
  return new Promise((resolve) => {
    db.serialize(() => {
      console.log(session, repo)
      let stmt = db.prepare(`INSERT INTO session (id, repo) VALUES(?, ?)`)
      stmt.run(session, repo);
      stmt.finalize();
      resolve();
    });
  });
}

let insert = (session, hash, value, nodes, time) => {
  return new Promise((resolve) => {
    db.serialize(() => {
      let stmt = db.prepare(`INSERT INTO results (session, hash, value, nodes, time) VALUES(?, ?, ?, ?, ?)`)
      stmt.run(session, hash, value, nodes, time, (e) => {
        if(e) console.log(e);
        stmt.finalize();
      });
      resolve();
    })
  })
}

let lookup_all = (session) => {
  return new Promise((resolve) => {
    db.serialize(() => {
      let stmt = db.prepare(`SELECT * FROM results WHERE session = ?`)
      stmt.all(session, (e, rows) => {

        stmt.finalize();
        resolve(rows);
      });

    });
  });
}

let lookup = (hash) => {
  return new Promise((resolve) => {
    db.serialize(() => {
      console.log("ppare")
      let stmt = db.prepare(`SELECT * FROM results WHERE hash = ?`)
      stmt.all(hash, (e, rows) => {
        stmt.finalize();
        resolve(rows);
      });
      stmt.finalize();
    })
  });
}

module.exports = { create_session, insert, lookup, lookup_all };