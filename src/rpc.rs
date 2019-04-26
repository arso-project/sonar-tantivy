use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Message {
  pub id: String,
  #[serde(flatten)]
  pub payload: MessageType
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type", content="payload")]
pub enum MessageType {
  CreateIndex(CreateIndex),
  AddDocuments(AddDocuments),
  Query(Query),
  AddSegment(AddSegment)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateIndex {
  pub name: String,
  // This is later casted into tantivy::schema::Schema
  pub schema: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AddDocuments {
  pub index: String,
  pub documents: Vec<Document>
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Document {
  pub id: String,
  pub title: String,
  pub body: String,
  pub tags: Vec<String>
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Query {
  pub index: String,
  pub query: String,
  pub limit: Option<u32>
 }

#[derive(Serialize, Deserialize, Debug)]
pub struct AddSegment {
  index: String,
  meta_json: String
}