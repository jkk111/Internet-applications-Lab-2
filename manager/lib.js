/*
 * Worker host is specific to my setup, I have a restful API running on
 * a non-scss server that wil setup N docker nodes configured with my docker image
 * Which in this case is ia-lab-2-worker and will return N port numbers
 */

const request = require('request-promise');
const crypto = require('crypto');
const fmt = '--pretty=format:{ \"commit\": \"%H\", \"message\": \"%f\" }';
const spawn = require('child_process').spawn;
const spawnSync = require('child_process').spawnSync;
const path = require('path')
const mime = require('mime-types')
const db = require('./db')
const fs = require('fs');

let repos = {} // maps repo to a session id
let sessions = {}; // maps a session to a repo on disk

let create_session_id = (len = 16) => {
  return crypto.randomBytes(len / 2).toString('hex')
}

let build_dir_list = (dir) => {
  return new Promise(async(resolve) => {
    let data = [];
    fs.readdir(dir, async(e, contents) => {
      if(e)
        resolve([])
      else {
        for(var entry of contents) {
          let fp = path.join(dir, entry)
          try {
            let stat = fs.statSync(path.join(fp))
            if(stat.isDirectory()) {
              data = [ ...data, ...(await build_dir_list(fp)), fp ]
            }
          } catch(e) {
            console.info('Failed to stat file', path.join(fp))
          }
        }
        resolve(data)
      }
    })
  })
}

let build_file_list = (dir, hide_git = true) => {
  return new Promise(async(resolve) => {
    let data = [];
    fs.readdir(dir, async(e, contents) => {
      if(e)
        resolve([])
      else {
        for(var entry of contents) {
          if(hide_git && entry === '.git')
            continue
          let fp = path.join(dir, entry)
          try {
            let stat = fs.statSync(path.join(fp))
            if(stat.isDirectory()) {
              data = [ ...data, ...(await build_file_list(fp)) ]
            } else {
              data.push(fp)
            }
          } catch(e) {
            console.info('Failed to stat file', path.join(fp))
          }
        }
        resolve(data)
      }
    })
  })
}

class GitMaster {
  constructor(repo, worker_host, num_workers = 32) {
    this.repo = repo;
    this.worker_host = worker_host;
    this.num_workers = num_workers;
    this.session = create_session_id();
    this.workers = [];
  }

  async init() {
    return new Promise(async (resolve, reject) => {
      if(!this.repo)
        throw new Error("No Repo Set");
      try {
        await db.create_session(this.session, this.repo)
        console.log("Initializing Docker Workers")
        let res = await request(`${this.worker_host}/start`, {
          qs: {
            image: 'ia-lab-2-worker',
            count: this.num_workers,
            session: this.session
          },
          json: true
        });
        this.workers = res;
      } catch(e) {
        throw e;
      }

      console.log("Got %d nodes", this.workers.length)

      let proc = spawn('git', [ 'clone', this.repo, this.session ])
      proc.stdout.pipe(process.stdout)
      proc.stderr.pipe(process.stderr)

      proc.on('exit', (c) => {
        if(c !== 0)
          reject();
        this.initialized = true;
        this.startTime = Date.now()
        resolve();
      })
    });
  }

  get commits() {
    if(!this.initialized)
      throw new Error("Master Not initialized");
    return new Promise((resolve) => {
      let commits = [];
      let ud = spawnSync('git', [ 'pull' ], { cwd: __dirname + '/' + this.session });
      let p = spawn('git', ['log', fmt ], { cwd: __dirname + '/' + this.session });

      p.stdout.on('data', (d) => {
        let lines = d.toString().split("\n");

        for(var line of lines) {
          line = line.trim();
          if(line == '') continue;
          try {
            var commit = JSON.parse(line);
            commits.push(commit);
          } catch(e) {
            console.log(e);
          }
        }
      });

      p.on('exit', () => {
        resolve(commits)
      })
    })
  }

  async work(wid, filelist) {
    let p = new Promise(async(resolve) => {
      let worker = `${this.workers[wid]}/analyze`;
      let results = {};

      while(filelist.length) {
        let file = filelist.pop()
        let filename = path.basename(file)
        let res = null;
        try {
          res = await request(worker, {
            method: 'post',
            formData: {
              files: {
                value: fs.createReadStream(file, {encoding: 'utf8'}),
                options: {
                  filename: filename,
                  contentType: mime.lookup(filename) || 'text/html'
                }
              }
            },
            json: true
          })
        } catch(e) {
          console.log(filename, e);
          filelist.push(file)
          continue;
        }
        if(res[filename] !== undefined) {
          results[file] = res[filename];
        }
      }

      resolve(results)
    })

    p.catch((e) => {
      this.work(wid, filelist)
    })

    return p;
  }

  async analyze(commit) {
    return new Promise(async (resolve) => {
      let dirty = false;
      if(commit) {
        dirty = true;
        spawnSync('git', ['checkout', commit]);
      }

      let pending = [];
      let filelist = await build_file_list(process.cwd())
      console.log("Processing %d files", filelist.length)
      for(var i = 0; i < this.num_workers; i++) {
        pending.push(this.work(i, filelist))
      }

      let results = {};

      for(var entry of pending) {
        let res = await entry;
        Object.assign(results, res);
      }

      if(dirty)
        spawnSync('git', ['checkout', 'master']);
      resolve(results);
    })
  }

  get time() {
    return Date.now() - this.startTime
  }

  async close() {
    await request(`${this.worker_host}/stop`, { qs: { session: this.session } } );

    let files = await build_file_list(__dirname + '/' + this.session, false);
    for(var file of files) {
      try {
        fs.unlinkSync(file);
      } catch(e) {}
    }

    let dirs = await build_dir_list(__dirname + '/' + this.session);

    for(var dir of dirs) {
      try {
        fs.rmdirSync(dir);
      } catch(e) {}
    }
    try {
      fs.rmdirSync(__dirname + '/' + this.session)
    } catch(e) {}
  }
}

let init = async(repo, docker = "http://localhost:8181", num_workers = 4) => {
  if(repos[repo])
    return repos[repo];

  return new Promise(async(resolve) => {
    let master = new GitMaster(repo, docker, num_workers);
    repos[repo] = master.session;
    sessions[master.session] = master;
    await master.init();
    resolve(master.session);
  })
}

let commits = async(session) => {
  let history = await sessions[session].commits;
  return history;
}

let analyze = async(session, commit) => {
  return new Promise(async(resolve) => {
    // Javascript is single threaded with an event loop
    // This forces the run time to give up control
    // to any pending task
    setImmediate(async() => {
      let ccn = await sessions[session].analyze(commit)
      resolve(ccn);
    })
  })
}

let analyze_all = async(session) => {
  let history = await commits(session);
  for(var {commit} of history) {
    await analyze(session, commit);
  }
}

let lookup = async(session) => {
  return new Promise(async(resolve) => {
    let data = await db.lookup_all(session);
  });
}

module.exports = {
  init,
  commits,
  analyze,
  analyze_all,
  lookup
}
