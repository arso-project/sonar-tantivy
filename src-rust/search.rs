use log::*;
use tantivy::collector::{FacetCollector, MultiCollector, TopDocs};
use tantivy::query::{AllQuery, QueryParser};
use tantivy::schema::*;
use tantivy::{Index, IndexReader};
use toshi_types::{CreateQuery, Error, FlatNamedDocument, KeyValue, Query, ScoredDoc, Search};

pub type SearchResults = toshi_types::SearchResults<FlatNamedDocument>;

pub fn search_index(
    index: &Index,
    reader: &IndexReader,
    search: Search,
) -> Result<SearchResults, Error> {
    let searcher = reader.searcher();
    let schema = index.schema();
    let mut multi_collector = MultiCollector::new();

    let sorted_top_handle = search.sort_by.clone().and_then(|sort_by| {
        info!("Sorting with: {}", sort_by);
        if let Some(f) = schema.get_field(&sort_by) {
            let entry = schema.get_field_entry(f);
            if entry.is_fast() && entry.is_stored() {
                let c = TopDocs::with_limit(search.limit).order_by_u64_field(f);
                return Some(multi_collector.add_collector(c));
            }
        }
        None
    });

    let top_handle = multi_collector.add_collector(TopDocs::with_limit(search.limit));
    let facet_handle = search.facets.clone().and_then(|f| {
        if let Some(field) = schema.get_field(f.get_facets_fields()) {
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
        let gen_query = match query {
            Query::Regex(regex) => regex.create_query(&schema)?,
            Query::Phrase(phrase) => phrase.create_query(&schema)?,
            Query::Fuzzy(fuzzy) => fuzzy.create_query(&schema)?,
            Query::Exact(term) => term.create_query(&schema)?,
            Query::Range(range) => range.create_query(&schema)?,
            Query::Boolean { bool } => bool.create_query(&schema)?,
            Query::Raw { raw } => {
                let fields: Vec<Field> = schema
                    .fields()
                    .filter_map(|f| schema.get_field(f.1.name()))
                    .collect();
                let query_parser = QueryParser::for_index(&index, fields);
                query_parser.parse_query(&raw)?
            }
            Query::All => Box::new(AllQuery),
        };

        trace!("{:?}", gen_query);
        let mut scored_docs = searcher.search(&*gen_query, &multi_collector)?;

        // FruitHandle isn't a public type which leads to some duplicate code like this.
        let docs: Vec<ScoredDoc<FlatNamedDocument>> = if let Some(h) = sorted_top_handle {
            h.extract(&mut scored_docs)
                .into_iter()
                .map(|(score, doc)| {
                    let d = searcher.doc(doc).expect("Doc not found in segment");
                    ScoredDoc::<FlatNamedDocument>::new(
                        Some(score as f32),
                        schema.to_named_doc(&d).into(),
                    )
                })
                .collect()
        } else {
            top_handle
                .extract(&mut scored_docs)
                .into_iter()
                .map(|(score, doc)| {
                    let d = searcher.doc(doc).expect("Doc not found in segment");
                    ScoredDoc::<FlatNamedDocument>::new(Some(score), schema.to_named_doc(&d).into())
                })
                .collect()
        };

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
        Err(Error::QueryError("Empty Query Provided".into()))
    }
}
