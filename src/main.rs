/// Minimal PoC
///
/// on writer:
/// - merge policy that copies to-be-merged segments to a backup location
/// - somehow, after a merge compare new segment meta list with old one
///
/// on reader:
/// - when receiving new metas write to directory
/// - use index.directory().atomic_write() to write a new meta.json
/// - this should automatically reload the Reader (if it has a ReloadPolicy Oncommit)
/// - for safety, all index writers should be destroyed before (but there would be none usually - only for merges maybe)

mod rpc;

use std::io::{self, BufRead};
use serde_json;
use tantivy;

fn main() {
    println!("Hello, world!");

    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        let line = line.expect("Could not read line from standard in");
        let _result = handle_message(line);
    }
}

fn handle_message(line: String) -> tantivy::Result<()> {
    println!("handling message: {}", line);
    let result: serde_json::Result<rpc::Message> = serde_json::from_str(&line);
    match result {
        Ok(message) => {
            println!("msg: {:#?}", message);
        }
        Err(err) => {
            println!("could not parse msg, error: {:#?}", err);
        }
    }
    Ok(())
}
