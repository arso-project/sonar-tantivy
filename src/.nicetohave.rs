
// segment handling fragments
    // let meta = SegmentMeta::new(
    //       SegmentId::generate_from_string(uuid_string),
    //       max_doc
    //       );
    // let index = self.index.clone();
    // let segment = Segment::create_segment(index, meta);
    //let mut directory = self.index.directory_mut().clone();
    // let schema = self.index.schema().clone();
    // let mut metas = self.index.load_metas().unwrap();
    // for meta in metas.segments{println!("META: {:?}",meta);}
    //println!("META: {:?}", metas);
    //let json = serde_json::ser::to_string(&index_metas).expect("serialization failed");
    //println!("SEGMENTS: {:?}", segments);
    //directory.atomic_write(Path::new("meta.json"), data);
    //let read = directory.open_read(&path).unwrap();