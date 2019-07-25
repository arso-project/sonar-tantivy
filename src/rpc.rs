extern crate serde_json;
extern crate varinteger;

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::any::Any;
use std::collections::HashMap;
use std::fmt::Debug;
use std::io::{self, BufRead, Write};
use std::rc::Rc;

// pub enum Result<T> {
//     Ok(T),
//     Err(String),
// }

#[derive(Serialize, Deserialize, Debug)]
pub enum Message<Req, Res>
// where
//     Req: Serialize + DeserializeOwned + Debug + Clone,
//     Res: Serialize + DeserializeOwned + Debug + Clone,
{
    Request(Request<Req>),
    Response(Response<Res>)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Request<Req>
// where 
//     Req: Serialize + DeserializeOwned + Debug + Clone,
{
    id: u64,
    method: String,
    msg: Option<Box<Req>>
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Response<Res>
// where
//     Res: Serialize + DeserializeOwned + Debug + Clone,
{
    request_id: u64,
    msg: Option<Box<Res>>,
    err: Option<String>,
}

impl<Req> Request<Req>
where
    Req: Serialize + DeserializeOwned + Debug + Clone,
{
    pub fn message(&self) -> Option<Req>
    {
        match self.msg {
            Some(req) => Some(*req),
            None => None
        }
    }

    pub fn empty() -> Request<()> {
        Request {
            id: 0,
            method: "".to_string(),
            msg: None
        }
    }
}

impl<Res> Response<Res>
where
    Res: Serialize + Debug,
{
    pub fn new(request_id: u64, msg: Res) -> Response<Res>
    where
        Res: Serialize,
    {
        Response {
            request_id: request_id,
            msg: Some(Box::new(msg)),
            err: None,
        }
    }

    pub fn error(request_id: u64, error: String) -> Response<Res> {
        Response {
            request_id: request_id,
            msg: None,
            err: Some(error),
        }
    }

    pub fn ok(request_id: u64, msg: Res) -> Response<Res> {
        Response {
            request_id: request_id,
            msg: Some(Box::new(msg)),
            err: None,
        }
    }

    pub fn to_json(&self) -> serde_json::Result<String> {
        serde_json::to_string(&self)
    }

    pub fn empty(request_id: u64) -> Response<Res> {
        Response {
            request_id: request_id,
            msg: None,
            err: None,
        }
    }
}

pub struct Rpc<State, Req, Res, E>
where
    E: std::string::ToString + 'static,
    Res: Serialize + Debug,
    Req: DeserializeOwned + Serialize + Debug
{
    state: State,
    methods: HashMap<String, Rc<dyn Fn(&mut State, &Request<Req>) -> Result<Res, E>>>,
    callbacks: Vec<Rc<dyn Fn(&mut State, &Response<Res>)>>
}

impl<State, Req, Res, E> Rpc<State, Req, Res, E>
where
    E: std::string::ToString + 'static,
    Res: Serialize + Debug,
    Req: DeserializeOwned + Serialize + Debug
{
    pub fn new(state: State) -> Rpc<State, Req, Res, E> {
        Rpc {
            state,
            methods: HashMap::new(),
            callbacks: vec![]
        }
    }

    pub fn at(&mut self, name: &str, method: &'static dyn Fn(&mut State, &Request<Req>) -> Result<Res, E>) {
        let rc_method = Rc::new(method);
        self.methods.insert(name.to_string(), rc_method);
    }

    pub fn handle_call(&mut self, request: Request<Req>) -> Response<Res> {
        let request_id = request.id.clone();
        if let Some(method) = self.methods.get(&request.method) {
            let msg = method(&mut self.state, &request);
            match msg {
                Ok(msg) => return Response::ok(request_id, msg),
                Err(err) => return Response::error(request_id, err.to_string()),
            }
        } else {
            return Response::error(request_id, "Method not found.".to_string());
        }
    }

    pub fn handle_json(&mut self, json: &str) -> Response<Res> {
        let result: serde_json::Result<Request<Req>> = serde_json::from_str(json);
        match result {
            Ok(request) => self.handle_call(request),
            Err(err) => Response::error(0, err.to_string()),
        }
    }

    pub fn request(&mut self, method: &str, msg: Req, callback: Option<&'static dyn Fn(&mut State, &Response<Res>) -> Result<Res, E>>) {
        let id = match callback {
            Some(callback) => {
                let rc_callback = Rc::new(callback);
                self.callbacks.push(rc_callback);
                self.callbacks.len() - 1
            },
            None => 0
        };
        self.send(Message::Request(Request {
            id: id as u64,
            method: method.to_string(),
            msg: Some(Box::new(msg))
        }));
    }

    pub fn stdio_loop(&mut self) {
        let stdin = io::stdin();
        // let mut stdout = io::stdout();
        let handshake = hello();
        self.send(Message::Request(handshake));

        for line in stdin.lock().lines() {
            let line = line.expect("Could not read line from standard in");
            eprintln!("RECV: {}", line);
            let response = self.handle_json(&line);
            self.send(Message::Response(response))
        }
    }


    fn send (&self, msg: Message<Req, Res>) {
        let json = match msg {
            Message::Request(ref req) => serde_json::to_string(&req),
            Message::Response(ref res) => serde_json::to_string(&res),
        };
        match json {
            Ok(str) => println!("{}", str),
            Err(err) => eprintln!("Could not serialize message.")
        }
    }
}

fn hello () -> Request<()> {
    Request {
        id: 0,
        method: "hello".to_string(),
        msg: None
    }
}

// fn decode_message(msg: &str) {
//     let mut msg_length = 0u64;
//     let header_len = varinteger::decode(msg.as_bytes(), &mut msg_length);
// }
