# Archipel & Sonar

The aim of this document is to give a rough overview on Archipel and Sonar. Please keep in mind that most parts of this are currently not yet implemented or in a state of flux. Our current [Archipel app](https://github.com/arso-project/archipel) needs refactoring for recent developments in the [Dat](https://dat.foundation) stack, and we're just starting to prototype the first iteration of [Sonar](https://github.com/arso-project/sonar).

## Basic data structures

* **filestore**: A hyperdrive that stores (hyper)media files
* **contentstore**: A hypertrie that stores objects and their relations
* **indexer**: A kappa-core on the contentstore which moves data into a levelgraph and a tantivy index.
* **indexstore**: A hyperdrive (hypercore?) that stores a tantivy search index
* **metastore**: A hypertrie that stores references to the other stores, configuration and shared state

Archipel provides an RPC API for Hypercores, Hypertries, Hyperdrives, Kappa core, and some high-level function to manage the system through a metastore.

The different data structures are linked through shared queues, which are either implemented as hypercores or as simple in-memory queues. The basic API for queues is `get`, `append`, `head`, `list`, and `watch`.

Example workflow:

I open the Archipel app. The Archipel app allows me to chose a backend (run in browser or chose rpc endpoint). I create a new archive. This means a new metastore is created, possibly by default with a filestore, a contentstore and an index store. I upload some files. This (or a click) triggers entries being pushed onto the worklog. A content extractor listens on the worklog. It writes results into the contentstore. The indexstore is a kappa-core on top of the contentstore which indexes into a levelgraph and a tantivy index.

The commandlog is a log of messages. All messages have an initial record that consists at least of a uuid, which is considered the primary result of the work. Usually, it also includes a link to a resource, and a command. The initial commands are `import`, `extract` and `delete`. `import` commands have an importer (e.g. url) and opts. Extract commands have a `link` and opts. Workers listen on commands and one of three stages (start, middle, end). Workers in the same stage may run concurrently. After finishing, workers return a new set of records. These new records are written into the worker's worklog. After each stage, results are merged. In case of multiple entries subsequent stages can access either the `best` or all entries. Workers may also have access to the RPC api. The remaining records after the end stage are written into the content store. 
