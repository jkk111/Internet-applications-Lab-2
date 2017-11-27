/*
 * Simple script that calls docker commands to setup N instances of a service
 */

let spawn = require('child_process').spawn;
let express = require('express')
let app = express();
let fs = require('fs')

let sessions = {};

let kill = (id) => {
  return new Promise((resolve) => {
    let proc = spawn('docker', [ 'kill', id ]);

    proc.stdout.pipe(process.stdout)
    proc.stderr.pipe(process.stderr)

    proc.on('exit', () => {
      resolve();
    })
  })
}

let create = (image, session) => {
  if(!sessions[session])
    sessions[session] = [];
  return new Promise((resolve) => {
    let proc = spawn('docker', [ 'run', '--net=pub_net', '-d', '--expose', '8888', image ]);
    let output = ''

    let out = fs.createWriteStream('out-' + Date.now() + ".log");

    proc.stdout.on('data', (d) => {
      output += d.toString();
    })

    proc.once('exit', () => {
      out.write(output);
      let code = output.trim();
      sessions[session].push(code)
      proc = spawn('docker', [ 'inspect', code ]);
      output = '';

      proc.stdout.on('data', (d) => {
        output += d.toString();
        out.write(d);
      })

      proc.on('exit', () => {
        let d = JSON.parse(output);
        resolve(`http://${d[0].NetworkSettings.Networks.pub_net.IPAddress}:8888`);
      })
    })
  })
}

app.get('/start', async(req, res) => {
  let resp = []
  for(var i = 0; i < req.query.count; i++) {
    resp[i] = await create(req.query.image, req.query.session)
  }
  res.send(resp);
});

app.get('/stop', async(req, res) => {
  let session = sessions[req.query.session];

  console.log(session, sessions, req.query.session)

  if(session) {
    for(var host of session) {
      await kill(host);
    }
  }

  res.send("OK")
})

app.get('/close', async(req, res) => {
  for(var session in sessions) {
    for(var host of sessions[session]) {
      await kill(host);
    }
  }

  res.send("OK")
  process.exit();
})

app.listen(8181)