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

use crate::rpc::*;

fn main() {
    println!("Hello, world!");

    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        let line = line.expect("Could not read line from standard in");
        let _result = parse_message(line);
    }
}

fn parse_message(line: String) -> tantivy::Result<()> {
    println!("handling message: {}", line);
    let result: serde_json::Result<rpc::Message> = serde_json::from_str(&line);
    match result {
        Ok(message) => {
            println!("msg: {:#?}", message);
            let _result = match message.payload {
                rpc::MessageType::CreateIndex(msg) => msg.handle(),
                rpc::MessageType::AddDocuments(msg) => msg.handle(),
                rpc::MessageType::Query(msg) => msg.handle(),
                rpc::MessageType::AddSegment(msg) => msg.handle(),
            };
        }
        Err(err) => {
            println!("could not parse msg, error: {:#?}", err);
        }
    }
    Ok(())
}

pub trait Handle {
  fn handle (&self) -> tantivy::Result<()>;
}

impl Handle for CreateIndex {
  fn handle (&self) -> tantivy::Result<()> {
    println!("Create index!");
    Ok(())
  }
}

impl Handle for AddDocuments {
  fn handle (&self) -> tantivy::Result<()> {
    println!("Add documents!");
    Ok(())
  }
}

impl Handle for Query {
  fn handle (&self) -> tantivy::Result<()> {
    println!("query!");
    Ok(())
  }
}

impl Handle for AddSegment {
  fn handle (&self) -> tantivy::Result<()> {
    println!("add segment!");
    Ok(())
  }
}