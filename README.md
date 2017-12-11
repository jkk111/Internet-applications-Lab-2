# Internet-applications-Lab-2

This project is broken down into 3 main parts

## Manager
Acts as the public rest API for the project, works with the docker manager and the workers to calculate the results

## Docker Manager
Basic Rest API that allows instantiating a specified number of docker nodes with a specific image

## Worker
Worker used to calculate the Cyclomatic Complexity of a repo

### Setup
#### Docker Host
Clone repo
Install Worker

```
cd Internet-applications-Lab-2/worker
docker build -t ia-lab-2-worker .
```

Then Run the docker script
```
cd ../util
npm install
node local_docker_host.js
```

#### Manager
Clone Repo
```
cd Internet-applications-Lab-2/manager
npm install
node index.js
```

### Usage
GET - /init
```
Query Params: {
  num_workers: <number of workers to spawn>,
  docker: <address of docker host>
  repo: <git repo to clone>
}
```

### Usage
GET - /status
```
Query Params: {
  session: <session id>,
}
```

Returns build, clone, ready, busy or finished

### Usage
GET - /analyze_all
```
Query Params: {
  session: <session id>
}
```
Starts running analysis across all commits in the repo, can take some time

### Usage
GET - /lookup
```
Query Params: {
  session: <session id>
}
```

Returns a json object containing all of the current results for a given session
