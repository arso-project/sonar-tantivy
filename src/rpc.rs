use serde::{Deserialize, Serialize};
use serde_json;
use std::collections::HashMap;
use tantivy::schema::{NamedFieldDocument, Schema, Value};
use tantivy::{Result};
use std::fmt;

#[derive(Serialize, Deserialize, Debug)]
pub struct Message {
  pub id: String,
  #[serde(flatten)]
  pub payload: MessageType,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type", content = "payload")]
pub enum MessageType {
  CreateIndex(CreateIndex),
  AddDocuments(AddDocuments),
  Query(Query),
  AddSegment(AddSegment),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateIndex {
  pub name: String,
  // This is later casted into tantivy::schema::Schema
  pub schema: serde_json::Value,
  // pub schema: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AddDocuments {
  pub index: String,
  // pub documents: Vec<Document>
  pub documents: Vec<Vec<(String, Value)>>,
}

// #[derive(Serialize, Deserialize, Debug)]
// pub struct Document {
//   pub id: String,
//   pub title: String,
//   pub body: String,
//   pub tags: Vec<String>
// }

#[derive(Serialize, Deserialize, Debug)]
pub struct Query {
  pub index: String,
  pub query: String,
  pub limit: Option<u32>,
}
#[derive(Serialize, Debug)]
pub struct QueryResponse {
  pub results: Vec<QueryResponseDocument>,
}

#[derive(Serialize)]
pub struct QueryResponseDocument {
  pub score: f32,
  pub doc: NamedFieldDocument,
}

impl fmt::Debug for QueryResponseDocument {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "QueryResponseDocument")
    }
}

impl QueryResponseDocument {
  pub fn from_tantivy_doc (score: f32, doc: NamedFieldDocument) -> Result<QueryResponseDocument> {
    Ok(QueryResponseDocument {
      score,
      doc
    })
  }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AddSegment {
  pub index: String,
  pub meta_json: String,
}
