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

fn main() {
    println!("Hello, world!");
}
