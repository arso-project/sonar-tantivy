use crate::index::{IndexCatalog, SegmentInfo};
use crate::rpc::Request;
use failure::Error;
use serde::{Deserialize, Serialize};
use serde_json;
use std::fmt;
use tantivy::schema::{NamedFieldDocument, Value};

/// Handles
///
/// In this files the RPC handlers are defined, together
/// with the structs for requests and responses.
/// Requests and responses have to be JSON serializable.

#[derive(Serialize, Debug)]
#[serde(untagged)]
pub enum Res {
    Empty(Empty),
    QueryResponse(QueryResponse),
    Bool(bool),
}

impl Res {
    pub fn empty() -> Res {
        Res::Empty(Empty {})
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Empty {}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateIndex {
    pub name: String,
    // This is later casted into tantivy::schema::Schema
    pub schema: serde_json::Value,
}

pub fn create_index(catalog: &mut IndexCatalog, request: &Request) -> Result<Res, Error> {
    let req: CreateIndex = request.message()?;
    let schema_json = serde_json::to_string(&req.schema)?;
    let schema: tantivy::schema::Schema = serde_json::from_str(&schema_json)?;
    catalog.create_index(req.name.clone(), schema)?;
    Ok(Res::empty())
}

pub fn index_exists(catalog: &mut IndexCatalog, request: &Request) -> Result<Res, Error> {
    let name: String = request.message()?;
    let has = match catalog.get_index(&name) {
        Ok(_) => true,
        Err(_) => false,
    };
    Ok(Res::Bool(has))
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AddDocuments {
    pub index: String,
    // pub documents: Vec<Document>
    pub documents: Vec<Vec<(String, Value)>>,
}

pub fn add_documents(catalog: &mut IndexCatalog, request: &Request) -> Result<Res, Error> {
    let req: AddDocuments = request.message()?;
    let handle = catalog.get_index(&req.index)?;
    handle.add_documents(&req.documents)?;
    Ok(Res::empty())
}

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

impl QueryResponseDocument {
    pub fn from_tantivy_doc(
        score: f32,
        doc: NamedFieldDocument,
    ) -> Result<QueryResponseDocument, Error> {
        Ok(QueryResponseDocument { score, doc })
    }
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

pub fn query(catalog: &mut IndexCatalog, request: &Request) -> Result<Res, Error> {
    let req: Query = request.message()?;
    let handle = catalog.get_index(&req.index)?;
    let tantivy_results = handle.query(&req.query, req.limit.unwrap_or(10))?;
    let mut results = vec![];
    for (score, doc) in tantivy_results {
        let result = QueryResponseDocument::from_tantivy_doc(score.clone(), doc);
        if let Ok(doc) = result {
            results.push(doc)
        }
    }

    let response = QueryResponse { results };
    // Ok(response)
    Ok(Res::QueryResponse(response))
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AddSegment {
    pub index: String,
    pub segment_id: String,
    pub max_doc: u32,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AddSegments {
    pub index: String,
    pub segments: Vec<SegmentInfo>,
}

pub fn add_segment(catalog: &mut IndexCatalog, request: &Request) -> Result<Res, Error> {
    let req: AddSegment = request.message()?;
    let handle = catalog.get_index(&req.index)?;
    handle.add_segment(&req.segment_id, req.max_doc)?;
    Ok(Res::empty())
}

pub fn add_segments(catalog: &mut IndexCatalog, request: &Request) -> Result<Res, Error> {
    let req: AddSegments = request.message()?;
    let handle = catalog.get_index(&req.index)?;
    handle.add_segments(req.segments)?;
    Ok(Res::empty())
}
