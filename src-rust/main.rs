extern crate failure;
use crate::index::IndexCatalog;
use rpc::Rpc;
use std::env;
use std::io;
use std::path::PathBuf;

/// Minimal PoC
///
/// on writer:
/// - merge policy that copies to-be-merged segments to a backup location
/// - somehow, after a merge compare new segment meta list with old one
///
/// on reader:
/// - when receiving new metas write to directory
/// - use index.directory().atomic_write() to write a new meta.json
/// - this should automatically reload the Reader (if it has a ReloadPolicy Oncommit)
/// - for safety, all index writers should be destroyed before (but there would be none usually - only for merges maybe)
mod handles;
mod index;
mod rpc;

fn main() -> io::Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 2 {
        eprintln!("USAGE: {} BASE_PATH", &args[0]);
        ::std::process::exit(1);
    }

    let base_path = PathBuf::from(&args[1]);
    let catalog = IndexCatalog::new(base_path)?;
    let mut rpc = Rpc::new(catalog);
    rpc.at("create_index", &handles::create_index);
    rpc.at("create_ram_index", &handles::create_ram_index);
    rpc.at("index_exists", &handles::index_exists);
    rpc.at("add_documents", &handles::add_documents);
    rpc.at("query", &handles::query);
    rpc.at("query_multi", &handles::query_multi);
    rpc.at("add_segment", &handles::add_segment);
    rpc.at("add_segments", &handles::add_segments);
    rpc.stdio_loop();
    Ok(())
}
