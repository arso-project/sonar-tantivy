use crate::handles::Res;
use crate::index::IndexCatalog;
use crate::rpc::Request;
use failure::Error;
use serde::Deserialize;
use serde_json::Value;
use toshi_query::search::search_index;
use toshi_query::{Search, SearchResults};

#[derive(Deserialize)]
struct QueryRequest {
    index: String,
    search: Search,
}

struct QueryResponse {
    results: SearchResults,
}

pub fn query_json(catalog: &mut IndexCatalog, request: &Request) -> Result<Res, Error> {
    let request: QueryRequest = request.message()?;
    // eprintln!("QUERY {:?}", req);
    let handle = catalog.get_index(&request.index)?;
    // let tantivy_results = handle.query(&req.query, req.limit.unwrap_or(10), req.snippet_field)?;
    let reader = handle.get_reader()?;
    let searcher = reader.searcher();

    let results = search_index(&handle.index, &searcher, request.search);
    match results {
        Ok(results) => {
            // let value: Value = Value::from(results);
            let string = serde_json::to_string(&results).unwrap();
            Ok(Res::Json(string))
        }
        Err(err) => Err(err.into()),
    }
}
