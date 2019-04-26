use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Message {
  id: String,
  #[serde(flatten)]
  payload: MessageType
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
  name: String,
  schema: String // json
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AddDocuments {
  documents: Vec<Document>
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Document {
  id: String,
  title: String,
  body: String,
  tags: Vec<String>
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Query {
  query: String,
  limit: u32
 }

#[derive(Serialize, Deserialize, Debug)]
pub struct AddSegment {
   index: String,
   meta_json: String
 }