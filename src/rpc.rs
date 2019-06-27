extern crate serde_json;

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::any::Any;
use std::collections::HashMap;
use std::fmt::Debug;
use std::io::{self, BufRead, Write};
use std::rc::Rc;

// pub enum Result<T> {
//     Ok(T),
//     Err(String),
// }

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Request {
    id: u64,
    msgtype: String,
    msg: serde_json::Value,
}

impl Request {
    pub fn message<T>(&self) -> Result<T, serde_json::Error>
    where
        T: DeserializeOwned,
    {
        let req: Result<T, serde_json::Error> = serde_json::from_value(self.msg.clone());
        req
    }

    pub fn empty() -> Request {
        Request {
            id: 0,
            msgtype: "".to_string(),
            msg: serde_json::Value::Null,
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Response<T>
where
    T: Serialize + Debug,
{
    request_id: u64,
    msg: Option<Box<T>>,
    err: Option<String>,
}

impl<T> Response<T>
where
    T: Any + Serialize + Debug,
{
    pub fn new(request: Request, msg: T) -> Response<T>
    where
        T: Serialize,
    {
        Response {
            request_id: request.id,
            msg: Some(Box::new(msg)),
            err: None,
        }
    }

    pub fn error(request: Request, error: String) -> Response<T> {
        Response {
            request_id: request.id,
            msg: None,
            err: Some(error),
        }
    }

    pub fn ok(request: Request, msg: T) -> Response<T> {
        Response {
            request_id: request.id,
            msg: Some(Box::new(msg)),
            err: None,
        }
    }

    pub fn to_json(&self) -> serde_json::Result<String> {
        serde_json::to_string(&self)
    }

    pub fn empty(request: Request) -> Response<T> {
        Response {
            request_id: request.id,
            msg: None,
            err: None,
        }
    }
}

pub struct Rpc<State, T, E>
where
    T: Any + Serialize + Debug,
    E: std::string::ToString,
{
    state: State,
    methods: HashMap<String, Rc<Fn(&mut State, &Request) -> Result<T, E>>>,
}

impl<State, T, E> Rpc<State, T, E>
where
    T: Any + Serialize + Debug,
    E: std::string::ToString,
{
    pub fn new(state: State) -> Rpc<State, T, E> {
        Rpc {
            state,
            methods: HashMap::new(),
        }
    }

    pub fn at(&mut self, name: &str, method: &'static Fn(&mut State, &Request) -> Result<T, E>) {
        let rc_method = Rc::new(method);
        self.methods.insert(name.to_string(), rc_method);
    }

    pub fn handle_call(&mut self, request: Request) -> Response<T> {
        if let Some(method) = self.methods.get(&request.msgtype) {
            let msg = method(&mut self.state, &request);
            match msg {
                Ok(msg) => return Response::ok(request, msg),
                Err(err) => return Response::error(request, err.to_string()),
            }
        } else {
            return Response::error(request, "Method not found.".to_string());
        }
    }

    pub fn handle_json(&mut self, json: &str) -> Response<T> {
        let result: serde_json::Result<Request> = serde_json::from_str(json);
        match result {
            Ok(request) => self.handle_call(request),
            Err(err) => Response::error(Request::empty(), err.to_string()),
        }
    }

    pub fn stdio_loop(&mut self) {
        let stdin = io::stdin();
        let mut stdout = io::stdout();
        for line in stdin.lock().lines() {
            let line = line.expect("Could not read line from standard in");
            let response = self.handle_json(&line);
            if let Ok(json) = serde_json::to_string(&response) {
                println!("{}", json)
            } else {
                eprintln!("Could not serialize response.");
            }
        }
    }
}
