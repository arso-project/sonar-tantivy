use crate::handles::Res;
use crate::index::IndexCatalog;
use crate::rpc::Request;
use crate::search::search_index;
use failure::Error;
use serde::Deserialize;
use toshi_types::Search;

#[derive(Deserialize)]
struct QueryRequest {
    index: String,
    search: Search,
}

pub fn query_json(catalog: &mut IndexCatalog, request: &Request) -> Result<Res, Error> {
    let request: QueryRequest = request.message()?;
    let handle = catalog.get_index(&request.index)?;
    let reader = handle.get_reader()?;

    let results = search_index(&handle.index, &reader, request.search);
    match results {
        Ok(results) => {
            // let value: Value = Value::from(results);
            let string = serde_json::to_string(&results).unwrap();
            Ok(Res::Json(string))
        }
        Err(err) => Err(err.into()),
    }
}
