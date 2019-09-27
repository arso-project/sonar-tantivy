use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};

use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::*;
use tantivy::{
    self, Directory, Index, IndexMeta, IndexReader, IndexWriter, ReloadPolicy, Result, SegmentId,
    SnippetGenerator, TantivyError,
};

pub struct IndexCatalog {
    pub base_path: PathBuf,
    pub indexes: HashMap<String, IndexHandle>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SegmentInfo {
    pub segment_id: String,
    pub max_doc: u32,
}

impl IndexCatalog {
    pub fn new(base_path: PathBuf) -> io::Result<Self> {
        if !base_path.exists() {
            Self::mkdir(&base_path)?;
        }

        let mut catalog = IndexCatalog {
            base_path,
            indexes: HashMap::new(),
        };

        catalog.load_all();

        Ok(catalog)
    }

    fn mkdir(base_path: &PathBuf) -> io::Result<()> {
        fs::create_dir_all(&base_path)
    }

    fn load_all(&mut self) {
        //let mut index_paths = vec![];
        if let Ok(entries) = fs::read_dir(&self.base_path) {
            // eprintln!("load all {:?}", entries);
            for entry in entries {
                if let Ok(entry) = entry {
                    self.load_from_dir_entry(entry);
                }
            }
        }
    }

    fn load_from_dir_entry(&mut self, entry: fs::DirEntry) {
        let mut path_to_metajson = entry.path().clone();
        path_to_metajson.push("meta.json");
        if path_to_metajson.exists() {
            let name = entry.file_name().into_string();
            if let Ok(name) = name {
                let result = Index::open_in_dir(entry.path());
                match result {
                    Ok(index) => {
                        let handle = IndexHandle::new(index);
                        // eprintln!("Loaded index: {}", &name);
                        self.indexes.insert(name, handle);
                    }
                    Err(err) => eprintln!(
                        "Opening index {:?} failed with error: {:#?}",
                        entry.path(),
                        err
                    ),
                }
            }
        } else {
            eprintln!(
                "Path in data dir, but not an index: {:?}",
                &path_to_metajson
            )
        }
    }

    pub fn create_index(&mut self, name: String, schema: Schema) -> Result<()> {
        // eprintln!("create_index {}", name);
        let mut index_path = self.base_path.clone();
        index_path.push(&name);
        fs::create_dir_all(&index_path)?;
        let index = Index::create_in_dir(&index_path, schema)?;
        let handle = IndexHandle::new(index);
        self.indexes.insert(name, handle);
        Ok(())
    }

    pub fn create_ram_index(&mut self, name: String, schema: Schema) -> Result<()> {
        let index = Index::create_in_ram(schema);
        let handle = IndexHandle::new(index);
        self.indexes.insert(name, handle);
        Ok(())
    }

    pub fn get_index(&mut self, name: &String) -> Result<&mut IndexHandle> {
        // eprintln!("get_index {}", name);
        // eprintln!("indexes: {:?}", self.indexes.keys());
        // eprintln!("get_index", name);
        let handle: &mut IndexHandle = match self.indexes.get_mut(name) {
            Some(handle) => Ok(handle),
            None => Err(TantivyError::InvalidArgument(
                "Index not found.".to_string(),
            )),
        }?;
        Ok(handle)
    }
    pub fn query_multi(
        &mut self,
        query: &String,
        indexes: &Vec<String>,
    ) -> Result<Vec<(String, Vec<(f32, NamedFieldDocument, Option<String>)>)>> {
        let mut results = vec![];
        for entry in indexes {
            let index_key = entry;
            if self.indexes.contains_key(index_key) {
                let index = self.get_index(&index_key.to_string())?;
                let res = index.query(query, 100, None)?;
                results.push((index_key.clone(), res));
            }
        }
        Ok(results)
    }
}

pub struct IndexHandle {
    pub index: Index,
    pub reader: Option<IndexReader>,
    // pub writer: Option<IndexWriter>,
    pub writer: Option<Arc<RwLock<IndexWriter>>>,
    pub query_parser: Option<QueryParser>,
}

impl IndexHandle {
    pub fn new(index: Index) -> Self {
        IndexHandle {
            index,
            reader: None,
            writer: None,
            query_parser: None,
        }
    }

    pub fn add_documents(&mut self, docs: &[Vec<(String, Value)>]) -> Result<()> {
        let schema = self.index.schema();
        let writer_lock = self.get_writer()?;
        {
            let writer = writer_lock.read()?;

            for doc in docs {
                let mut document = Document::default();
                for (field_name, value) in doc {
                    match schema.get_field(&field_name) {
                        Some(field) => document.add(FieldValue::new(field, value.clone())),
                        None => eprintln!("Invalid field: {}", field_name),
                    }
                }

                let _opstamp = writer.add_document(document);
                // eprintln!("added {:?}", _opstamp);
            }
        }
        {
            // eprintln!("now commit");
            let mut writer = writer_lock.write()?;
            let _opstamp = writer.commit()?;
            // eprintln!("committed {:?}", _opstamp);
        }
        Ok(())
    }

    pub fn get_writer(&mut self) -> Result<Arc<RwLock<IndexWriter>>> {
        self.ensure_writer()?;
        Ok(Arc::clone(self.writer.as_ref().unwrap()))
    }

    fn ensure_writer(&mut self) -> Result<()> {
        if self.writer.is_none() {
            let writer = self.index.writer(50_000_000)?;
            let writer = Arc::new(RwLock::new(writer));
            self.writer = Some(writer);
        }
        Ok(())
    }

    fn ensure_reader(&mut self) -> Result<()> {
        if self.reader.is_none() {
            let reader = self
                .index
                .reader_builder()
                .reload_policy(ReloadPolicy::OnCommit)
                .try_into()?;
            self.reader = Some(reader);
        }
        Ok(())
    }

    fn ensure_query_parser(&mut self) -> Result<()> {
        let schema = self.index.schema();
        if self.query_parser.is_none() {
            let mut fields = vec![];
            let all_fields = schema.fields();
            for field_entry in all_fields {
                if !field_entry.is_indexed() {
                    break;
                }
                if let Some(field) = schema.get_field(field_entry.name()) {
                    fields.push(field);
                } // else cannot happen.
            }
            let query_parser = QueryParser::for_index(&self.index, fields);
            self.query_parser = Some(query_parser);
        }
        Ok(())
    }

    pub fn query(
        &mut self,
        query: &str,
        limit: u32,
        snippet_field: Option<String>,
    ) -> Result<Vec<(f32, NamedFieldDocument, Option<String>)>> {
        self.ensure_reader()?;
        self.ensure_query_parser()?;
        let reader = self.reader.take().unwrap();
        let query_parser = self.query_parser.take().unwrap();
        let searcher = reader.searcher();
        let schema = self.index.schema();

        let query = query_parser.parse_query(query)?;
        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit as usize))?;

        let snippet_generator = match &snippet_field {
            Some(field_name) => {
                let field = schema.get_field(&field_name);
                match field {
                    Some(field) => Some(SnippetGenerator::create(&searcher, &*query, field)?),
                    None => None,
                }
            }
            None => None,
        };

        let mut results = vec![];
        for (score, doc_address) in top_docs {
            let retrieved_doc = searcher.doc(doc_address)?;
            let snippet = match &snippet_generator {
                Some(generator) => Some(generator.snippet_from_doc(&retrieved_doc).to_html()),
                None => None,
            };
            results.push((score, schema.to_named_doc(&retrieved_doc), snippet));
        }

        Ok(results)
    }

    pub fn add_segments(&mut self, segments: Vec<SegmentInfo>) -> Result<()> {
        for segment in segments {
            self.add_segment(&segment.segment_id, segment.max_doc)?;
        }
        Ok(())
    }

    pub fn add_segment(&mut self, uuid_string: &str, max_doc: u32) -> Result<()> {
        let mut segments = self.index.searchable_segment_metas()?;
        let segment_id = SegmentId::from_uuid_string(uuid_string)
            .map_err(|_err| TantivyError::InvalidArgument("Not a valid UUID string".to_string()))?;

        let existing_segment_ids = self.index.searchable_segment_ids()?;

        if !existing_segment_ids.contains(&segment_id) {
            let meta = self
                .index
                .inventory()
                .new_segment_meta(segment_id, max_doc as u32);
            segments.push(meta);
            let schema = self.index.schema();
            // add the counter of docs in segment to the index counter
            let opstamp = self.index.load_metas()?.opstamp + max_doc as u64;
            let metas = IndexMeta {
                segments,
                schema,
                opstamp,
                payload: None,
            };
            save_metas(&metas, self.index.directory_mut())?;
        } else {
            return Err(TantivyError::InvalidArgument("Segment exists.".to_string()));
        }

        if !self.index.searchable_segment_ids()?.contains(&segment_id) {
            return Err(TantivyError::InvalidArgument(
                "Adding segment failed.".to_string(),
            ));
        }
        Ok(())
    }
}

/// Copied from tantivy/src/core/mod.rs
pub static META_FILEPATH: Lazy<&'static Path> = Lazy::new(|| Path::new("meta.json"));

/// Copied from segment_updater.rs in tantivy.
fn save_metas(metas: &IndexMeta, directory: &mut dyn Directory) -> Result<()> {
    let mut buffer = serde_json::to_vec_pretty(metas)?;
    writeln!(&mut buffer)?;
    directory.atomic_write(&META_FILEPATH, &buffer[..])?;
    Ok(())
}

#[test]
fn create_empty_indexcatalog() {
    // let base_path = PathBuf::from(r"./test");
    let tmp_dir = tempdir::TempDir::new("test").unwrap();
    let base_path = tmp_dir.path().to_path_buf();
    let catalog = IndexCatalog::new(base_path).unwrap();
    assert_eq!(catalog.indexes.len(), 0);
}
#[test]
fn move_segment() {
    println!("start");
    let tmp_dir = tempdir::TempDir::new("test").unwrap();
    let base_path = tmp_dir.path().to_path_buf();

    // create a new index catalog, index catalog is a hashmap with indexname as key and index as value
    let mut catalog = IndexCatalog::new(base_path.clone()).unwrap();

    // create a new schema with one textfield called "field_str" and build this schema
    let mut schema_builder = Schema::builder();
    let field_str = schema_builder.add_text_field("field_str", STRING);
    let schema = schema_builder.build();
    // create two new indexes to compare the segment_ids after we call the add_segment method
    catalog
        .create_index("testindex1".to_string(), schema.clone())
        .unwrap();
    catalog
        .create_index("testindex2".to_string(), schema.clone())
        .unwrap();

    let handle1 = catalog.get_index(&"testindex1".to_string()).unwrap();

    let writer_lock1 = handle1.get_writer().unwrap();
    let mut writer1 = writer_lock1.write().unwrap();

    // create a new tantivy Document to push this doc to index1
    let mut doc = Document::new();
    doc.add_text(field_str, "sea");
    writer1.add_document(doc);
    writer1.commit().unwrap();

    let index1 = handle1.index.clone();
    let mut allsegments = index1.searchable_segment_ids().unwrap();

    let handle2 = catalog.get_index(&"testindex2".to_string()).unwrap();
    let index2 = handle2.index.clone();

    // get the segment_id for the segment in index1 and copy the files in index2 dir
    let moving_segment = allsegments.pop().unwrap();
    let uuid_string = moving_segment.uuid_string();
    let exts = [
        ".fast",
        ".fieldnorm",
        ".idx",
        ".pos",
        ".posidx",
        ".store",
        ".term",
    ];
    for ext in exts.iter() {
        let mut path1 = base_path.clone();
        path1.push(["testindex1/", &uuid_string, ext].concat());
        let mut path2 = base_path.clone();
        path2.push(["testindex2/", &uuid_string, ext].concat());
        let _result = fs::copy(path1, path2).unwrap();
    }

    handle2.add_segment(&uuid_string, 1).unwrap();
    assert_eq!(
        index2
            .searchable_segment_ids()
            .unwrap()
            .pop()
            .unwrap()
            .uuid_string(),
        uuid_string
    );

    let len = search(&index1, vec![field_str], "sea");
    assert_eq!(len, 1);
    let len = search(&index1, vec![field_str], "foo");
    assert_eq!(len, 0);
    let len = search(&index2, vec![field_str], "sea");
    assert_eq!(len, 1);

    fn search(index: &Index, fields: Vec<Field>, query: &str) -> usize {
        let searcher = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommit)
            .try_into()
            .unwrap()
            .searcher();

        let query_parser = QueryParser::for_index(&index, fields);

        // QueryParser may fail if the query is not in the right
        // format. For user facing applications, this can be a problem.
        // A ticket has been opened regarding this problem.
        let query = query_parser.parse_query(query).unwrap();

        let top_docs = searcher.search(&query, &TopDocs::with_limit(10)).unwrap();

        top_docs.len()

        // println!("results {:?}", top_docs.len());
        // for (_score, doc_address) in top_docs {
        //     let retrieved_doc = searcher.doc(doc_address).unwrap();
        //     println!("{}", index.schema().to_json(&retrieved_doc));
        // }
        // println!("done");
    }
}
