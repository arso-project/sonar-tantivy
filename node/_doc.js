
// index states
// create(schema) -> create key, index, drive
// open(key)
//   -> if existing: just open
//   -> if not existing:
//      - open hyperdrive
//      - wait for sync, load schema from meta
//      - create index
