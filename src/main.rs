mod index;
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

use serde_json;
use serde::{Deserialize, Serialize};

use std::io::{self, BufRead, Write};
use std::path::PathBuf;
use tantivy::schema::FieldValue;
use tantivy::{Document, Directory, Index, Result, TantivyError};

use crate::index::*;
use crate::rpc::*;

fn main() -> io::Result<()> {
  println!("Hello, world!");

  let base_path = PathBuf::from(r"./data");
  let mut catalog = IndexCatalog::new(base_path)?;

  let stdin = io::stdin();
  for line in stdin.lock().lines() {
    let line = line.expect("Could not read line from standard in");
    let result = parse_message(line);
    match result {
      Ok(message) => {
        println!("msg: {:#?}", message);
        let result = message.payload.handle(&mut catalog);
        println!("RESULT: {:#?}", result);
      }
      Err(err) => println!("Could not parse message, error: {:?}", err),
    }
  }

  Ok(())
}


fn reply<T> (response: T) -> io::Result<()> 
where T: Serialize {
  let string = serde_json::to_string(&response)?;
  // println!("SEND! {:?}", string);
  println!("{}", string);
  //io::stdout().write(string.as_bytes())?;
  Ok(())
}

fn parse_message(line: String) -> serde_json::Result<Message> {
  println!("handling message: {}", line);
  let result: serde_json::Result<rpc::Message> = serde_json::from_str(&line);
  result
}

pub trait Handle {
  fn handle(&self, catalog: &mut IndexCatalog) -> Result<()>;
}

impl Handle for Message {
  fn handle(&self, catalog: &mut IndexCatalog) -> Result<()> {
    self.payload.handle(catalog)
  }
}

impl Handle for MessageType {
  fn handle(&self, catalog: &mut IndexCatalog) -> Result<()> {
    match self {
      rpc::MessageType::CreateIndex(msg) => msg.handle(catalog),
      rpc::MessageType::AddDocuments(msg) => msg.handle(catalog),
      rpc::MessageType::Query(msg) => msg.handle(catalog),
      rpc::MessageType::AddSegment(msg) => msg.handle(catalog),
    }
  }
}

impl Handle for CreateIndex {
  fn handle(&self, catalog: &mut IndexCatalog) -> Result<()> {
    // todo: remove clones?
    // todo: This errors with some "text" string not being passed as reference.
    // let schema: tantivy::schema::Schema = serde_json::from_value(self.schema.clone())?;
    let schema_json = serde_json::to_string(&self.schema)?;
    let schema: tantivy::schema::Schema = serde_json::from_str(&schema_json)?;
    catalog.create_index(self.name.clone(), schema)?;
    Ok(())
  }
}

impl Handle for AddDocuments {
  fn handle(&self, catalog: &mut IndexCatalog) -> Result<()> {
    println!("Add documents!");
    let handle = catalog.get_index(&self.index)?;
    handle.add_documents(&self.documents)
  }
}

impl Handle for Query {
  fn handle(&self, catalog: &mut IndexCatalog) -> Result<()> {
    println!("query!");
    let handle = catalog.get_index(&self.index)?;
    let tantivy_results = handle.query(&self.query, self.limit.unwrap_or(10))?;
    let mut results = vec![];
    for (score, doc) in tantivy_results {
      let result = QueryResponseDocument::from_tantivy_doc(score.clone(), doc);
      if let Ok(doc) = result {
        results.push(doc)
      }
    }
    
    let response = QueryResponse {
      results
    };

    reply(response);
    Ok(())
  }
}

// TODO Matze: Idee ist das die Segmentfiles bereits im richtigen Indexordner liegen(Das soll später über node passieren).
// TODO Matze: Es gibt die managed.json dort wollen wir die Segment ID reinschreiben und dann das Segment comitten
// Ich hab angefangen den Handler und die Funktion dafür zu schreiben, das ist allerdings gerade mehr ein rumprobieren.  

impl Handle for AddSegment {
  fn handle(&self, catalog: &mut IndexCatalog) -> Result<()> {
      let handle = catalog.get_index(&self.index)?;
      let mut data = serde_json::from_str(&self)?;
      println!("addSegment, data: {}", data);
      let all_segments = vec![data.meta_json.segments];
      let mut segments = vec![]
      for segment in all_segments {
        segments.push(segment);
      }
      println!("addSegment, segments: {}", segments);
      handle.add_segment(
        &catalog.base_path, &segments
      );

    Ok(())
  }
}
