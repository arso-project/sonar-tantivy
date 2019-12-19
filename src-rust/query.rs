use crate::handles::Res;
use crate::index::IndexCatalog;
use crate::rpc::Request;
use failure::Error;
use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeMap;

use tantivy::query::{AllQuery, QueryParser};
use tantivy::schema::{Field, Value as TantivyValue};
use tantivy::{Index, Searcher};

use toshi_types::client::ScoredDoc;
use toshi_types::client::SearchResults as SD;
use toshi_types::error::Error as ToshiError;
use toshi_types::query::Search;
use toshi_types::query::*;

type SearchResults = SD<BTreeMap<String, Vec<TantivyValue>>>;
type ToshiResult<T> = std::result::Result<T, toshi_types::error::Error>;

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

use tantivy::collector::{FacetCollector, MultiCollector, TopDocs};

fn search_index(index: &Index, searcher: &Searcher, search: Search) -> ToshiResult<SearchResults> {
    let schema = index.schema();
    let collector = TopDocs::with_limit(search.limit);
    let mut multi_collector = MultiCollector::new();

    let top_handle = multi_collector.add_collector(collector);
    let facet_handle = search.facets.clone().and_then(|f| {
        if let Some(field) = schema.get_field(&f.get_facets_fields()) {
            let mut col = FacetCollector::for_field(field);
            for term in f.get_facets_values() {
                col.add_facet(&term);
            }
            Some(multi_collector.add_collector(col))
        } else {
            None
        }
    });

    if let Some(query) = search.query {
        let mut scored_docs = match query {
            Query::Regex(regex) => {
                let regex_query = regex.create_query(&schema)?;
                debug!("{:?}", regex_query);
                searcher.search(&*regex_query, &multi_collector)?
            }
            Query::Phrase(phrase) => {
                let phrase_query = phrase.create_query(&schema)?;
                debug!("{:?}", phrase_query);
                searcher.search(&*phrase_query, &multi_collector)?
            }
            Query::Fuzzy(fuzzy) => {
                let fuzzy_query = fuzzy.create_query(&schema)?;
                debug!("{:?}", fuzzy_query);
                searcher.search(&*fuzzy_query, &multi_collector)?
            }
            Query::Exact(term) => {
                let exact_query = term.create_query(&schema)?;
                debug!("{:?}", exact_query);
                searcher.search(&*exact_query, &multi_collector)?
            }
            Query::Boolean { bool } => {
                let bool_query = bool.create_query(&schema)?;
                debug!("{:?}", bool_query);
                searcher.search(&*bool_query, &multi_collector)?
            }
            Query::Range(range) => {
                let range_query = range.create_query(&schema)?;
                debug!("{:?}", range_query);
                searcher.search(&*range_query, &multi_collector)?
            }
            Query::Raw { raw } => {
                let fields: Vec<Field> = schema
                    .fields()
                    .filter_map(|(_, e)| schema.get_field(e.name()))
                    .collect();
                let query_parser = QueryParser::for_index(index, fields);
                let query = query_parser.parse_query(&raw)?;
                debug!("{:?}", query);
                searcher.search(&*query, &multi_collector)?
            }
            Query::All => searcher.search(&AllQuery, &multi_collector)?,
        };

        let docs: Vec<ScoredDoc<BTreeMap<_, _>>> = top_handle
            .extract(&mut scored_docs)
            .into_iter()
            .map(|(score, doc)| {
                let d = searcher.doc(doc).expect("Doc not found in segment");
                ScoredDoc::<BTreeMap<_, _>>::new(Some(score), schema.to_named_doc(&d).0)
            })
            .collect();

        if let Some(facets) = facet_handle {
            if let Some(t) = &search.facets {
                let facet_counts = facets
                    .extract(&mut scored_docs)
                    .get(&t.get_facets_values()[0])
                    .map(|(f, c)| KeyValue::new(f.to_string(), c))
                    .collect();
                return Ok(SearchResults::with_facets(docs, facet_counts));
            }
        }
        Ok(SearchResults::new(docs))
    } else {
        Err(ToshiError::QueryError("Empty Query Provided".into()))
    }
}
