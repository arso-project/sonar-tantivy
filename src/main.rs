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
mod index;

use std::path::PathBuf;
use std::io::{self, BufRead};
use serde_json;
use tantivy::{Result, Error};

use crate::rpc::*;
use crate::index::*;

fn main() {
    println!("Hello, world!");

    let base_path = PathBuf::from(r"./data");
    let mut catalog = IndexCatalog::new(base_path);

    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        let line = line.expect("Could not read line from standard in");
        let result = parse_message(line);
        match result {
            Ok(message) => {
                println!("msg: {:#?}", message);
                let _result = message.payload.handle(&mut catalog);
            },
            Err(err) => println!("Could not parse message, error: {:?}", err)
        }
    }
}

fn parse_message(line: String) -> serde_json::Result<Message> {
    println!("handling message: {}", line);
    let result: serde_json::Result<rpc::Message> = serde_json::from_str(&line);
    result
}


pub trait Handle {
  fn handle (&self, catalog: &mut IndexCatalog) -> Result<()>;
}

impl Handle for Message {
    fn handle (&self, catalog: &mut IndexCatalog) -> Result<()> {
        self.payload.handle(catalog)
    }
}

impl Handle for MessageType {
    fn handle (&self, catalog: &mut IndexCatalog) -> Result<()> {
        match self {
            rpc::MessageType::CreateIndex(msg) => msg.handle(catalog),
            rpc::MessageType::AddDocuments(msg) => msg.handle(catalog),
            rpc::MessageType::Query(msg) => msg.handle(catalog),
            rpc::MessageType::AddSegment(msg) => msg.handle(catalog),
        }
    }
}

impl Handle for CreateIndex {
  fn handle (&self, catalog: &mut IndexCatalog) -> Result<()> {
    // todo: remove clones?
    let schema: tantivy::schema::Schema = serde_json::from_value(self.schema.clone()).unwrap();
    let index = tantivy::Index::create_in_dir(catalog.base_path.clone(), schema)?;
    let handle = IndexHandle::new(index);
    catalog.indexes.insert(self.name.clone(), handle);
    println!("Create index!");
    Ok(())
  }
}

impl Handle for AddDocuments {
  fn handle (&self, catalog: &mut IndexCatalog) -> Result<()> {
    println!("Add documents!");
    Ok(())
  }
}

impl Handle for Query {
  fn handle (&self, catalog: &mut IndexCatalog) -> Result<()> {
    println!("query!");
    Ok(())
  }
}

impl Handle for AddSegment {
  fn handle (&self, catalog: &mut IndexCatalog) -> Result<()> {
    println!("add segment!");
    Ok(())
  }
}