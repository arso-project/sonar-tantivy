use std::cell::RefCell;
use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{PathBuf, Path};
use std::rc::Rc;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::{Document, FieldValue, NamedFieldDocument, Schema, Value};

use tantivy::{
  self, Directory, Index, IndexReader, IndexWriter, ReloadPolicy, Result, TantivyError,
};

pub struct IndexCatalog {
  pub base_path: PathBuf,
  pub indexes: HashMap<String, IndexHandle>,
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
            println!("Loaded index: {}", &name);
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

    println!("docs {:#?}", docs);

    for doc in docs {
      let mut document = Document::default();
      for (field_name, value) in doc {
        match schema.get_field(&field_name) {
          Some(field) => document.add(FieldValue::new(field, value.clone())),
          None => println!("Invalid field: {}", field_name),
        }
      }

      let opstamp = writer.add_document(document);
    }
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
  pub fn add_segment(&mut self,path : &Path, data : &[u8]) -> Result<()> {
    let directory = self.index.directory();
    directory.atomic_write(path, data);
    let read = directory.open_read(&path).unwrap();
    Ok(())
  }
}
