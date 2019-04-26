use std::collections::HashMap;
use tantivy::{self, Index, IndexReader, IndexWriter};
use std::path::PathBuf;

pub struct IndexCatalog {
    pub base_path: PathBuf,
    pub indexes: HashMap<String, IndexHandle>
}

impl IndexCatalog {
    pub fn new (base_path: PathBuf) -> Self {
        let catalog = IndexCatalog {
            base_path,
            indexes: HashMap::new()
        };
        catalog
    }
}

pub struct IndexHandle {
    pub index: Index,
    pub reader: Option<IndexReader>,
    pub writer: Option<IndexWriter>
}

impl IndexHandle {
  pub fn new (index: Index) -> Self {
    IndexHandle {
      index,
      reader: None,
      writer: None
    }
  }
}