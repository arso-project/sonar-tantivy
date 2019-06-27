#[macro_use]
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::io::Write;
use std::path::{Path, PathBuf};
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::*;
use tantivy::{
    self, Directory, Index, IndexMeta, IndexReader, IndexWriter, ReloadPolicy, Result, SegmentId,
    SegmentMeta, TantivyError,
};

pub struct IndexCatalog {
    pub base_path: PathBuf,
    pub indexes: HashMap<String, IndexHandle>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SegmentInfo {
    pub uuid: String,
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
                        // println!("Loaded index: {}", &name);
                        self.indexes.insert(name, handle);
                    }
                    Err(err) => println!(
                        "Opening index {:?} failed with error: {:#?}",
                        entry.path(),
                        err
                    ),
                }
            }
        } else {
            println!(
                "Path in data dir, but not an index: {:?}",
                &path_to_metajson
            )
        }
    }

    pub fn create_index(&mut self, name: String, schema: Schema) -> Result<()> {
        let mut index_path = self.base_path.clone();
        index_path.push(&name);
        fs::create_dir_all(&index_path);
        let index = Index::create_in_dir(&index_path, schema)?;
        let handle = IndexHandle::new(index);
        self.indexes.insert(name, handle);
        println!("Create index!");
        Ok(())
    }

    pub fn get_index(&mut self, name: &String) -> Result<&mut IndexHandle> {
        let handle: &mut IndexHandle = match self.indexes.get_mut(name) {
            Some(handle) => Ok(handle),
            None => Err(TantivyError::InvalidArgument(
                "Index not found.".to_string(),
            )),
        }?;
        Ok(handle)
    }
}

pub struct IndexHandle {
    pub index: Index,
    pub reader: Option<IndexReader>,
    pub writer: Option<IndexWriter>,
}

impl IndexHandle {
    pub fn new(index: Index) -> Self {
        IndexHandle {
            index,
            reader: None,
            writer: None,
        }
    }

    pub fn add_documents(&mut self, docs: &[Vec<(String, Value)>]) -> Result<()> {
        // let writer = self.get_writer()?;

        // let writer = handle.get_writer()?;

        // let index: &Index = &handle.index;
        self.ensure_writer()?;
        let schema = self.index.schema();
        let mut writer = self.writer.take().unwrap();

        for doc in docs {
            let mut document = Document::default();
            for (field_name, value) in doc {
                match schema.get_field(&field_name) {
                    Some(field) => document.add(FieldValue::new(field, value.clone())),
                    None => println!("Invalid field: {}", field_name),
                }
            }

            let opstamp = writer.add_document(document);
            eprintln!("added {:?}", opstamp);
        }
        eprintln!("now commit");
        writer.commit()?;
        self.writer = Some(writer);
        Ok(())
    }

    fn ensure_writer(&mut self) -> Result<()> {
        if self.writer.is_none() {
            let writer = self.index.writer(50_000_000)?;
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

    pub fn query(&mut self, query: &String, limit: u32) -> Result<Vec<(f32, NamedFieldDocument)>> {
        let mut metas = self.index.load_metas().unwrap();
        self.ensure_reader()?;
        let reader = self.reader.take().unwrap();
        let searcher = reader.searcher();
        let schema = self.index.schema();

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
        let query = query_parser.parse_query(query)?;
        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit as usize))?;

        let mut results = vec![];
        for (score, doc_address) in top_docs {
            let retrieved_doc = searcher.doc(doc_address)?;
            results.push((score, schema.to_named_doc(&retrieved_doc)));
        }

        Ok(results)
    }

    pub fn add_segments(&mut self, segments: Vec<SegmentInfo>) -> Result<()> {
        for segment in segments {
            self.add_segment(&segment.uuid, segment.max_doc);
        }
        Ok(())
    }

    pub fn add_segment(&mut self, uuid_string: &str, max_doc: u32) -> Result<()> {
        let mut segments = self.index.searchable_segment_metas()?;
        let segment_id = SegmentId::generate_from_string(uuid_string);

        if !self.index.searchable_segment_ids()?.contains(&segment_id) {
            segments.push(SegmentMeta::new(segment_id, max_doc));
            let schema = self.index.schema();
            // add the counter of docs in segment to the index counter
            let opstamp = self.index.load_metas()?.opstamp + max_doc as u64;
            let metas = IndexMeta {
                segments,
                schema,
                opstamp,
                payload: None,
            };
            let mut buffer = serde_json::to_vec_pretty(&metas)?;
            // just for newline
            writeln!(&mut buffer)?;
            self.index
                .directory_mut()
                .atomic_write(Path::new("meta.json"), &buffer[..])?;
        } else {
            return Err(TantivyError::InvalidArgument(
                "segment already indexed".to_string(),
            ));
        }

        if !self.index.searchable_segment_ids()?.contains(&segment_id) {
            return Err(TantivyError::InvalidArgument(
                "not possible to add segment".to_string(),
            ));
        }
        Ok(())
    }
}
#[test]
fn create_empty_indexcatalog() {
    let base_path = PathBuf::from(r"./test");
    fs::remove_dir_all(&base_path);
    let catalog = IndexCatalog::new(base_path).unwrap();
    assert_eq!(catalog.indexes.len(), 0);
}
#[test]
fn create_index() {
    let base_path = PathBuf::from(r"./test");
    fs::remove_dir_all(&base_path);
    /// create a new index catalog, index catalog is a hashmap with indexname as key and index as value
    let mut catalog = IndexCatalog::new(base_path).unwrap();
    /// create a new schema with one textfield called "field_str" and build this schema
    let mut schema_builder = Schema::builder();
    let field_str = schema_builder.add_text_field("field_str", STRING);
    let schema = schema_builder.build();
    /// create two new indexes to compare the segment_ids after we call the add_segment method
    catalog
        .create_index("testindex1".to_string(), schema.clone())
        .unwrap();
    catalog
        .create_index("testindex2".to_string(), schema)
        .unwrap();

    let index_handle = catalog.get_index(&"testindex1".to_string()).unwrap();
    index_handle.ensure_writer();
    let mut writer = index_handle.writer.take().unwrap();

    /// create a new tantivy Document to push this doc to index1
    let mut doc = Document::new();
    doc.add_text(field_str, "addsegment");
    writer.add_document(doc);
    writer.commit();

    let mut index1 = index_handle.index.clone();
    let mut allsegments = index1.searchable_segment_ids().unwrap();
    let index_handle2 = catalog.get_index(&"testindex2".to_string()).unwrap();
    let index2 = index_handle2.index.clone();
    /// get the segment_id for the segment in index1 and copy the files in index2 dir
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
        let pathstr1 = ["./test/testindex1/", &uuid_string, ext].concat();
        let pathstr2 = ["./test/testindex2/", &uuid_string, ext].concat();
        let mut path1 = PathBuf::from(pathstr1);
        let mut path2 = PathBuf::from(pathstr2);
        let result = fs::copy(path1, path2).unwrap();
    }

    index_handle2.add_segment(&uuid_string, 1).unwrap();
    assert_eq!(
        index2
            .searchable_segment_ids()
            .unwrap()
            .pop()
            .unwrap()
            .uuid_string(),
        uuid_string
    );
}
