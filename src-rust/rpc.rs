extern crate serde_json;
extern crate varinteger;

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::any::Any;
use std::collections::HashMap;
use std::fmt::Debug;
use std::io::{self, BufRead};
use std::rc::Rc;

#[derive(Serialize, Deserialize, Debug)]
pub enum Message<T>
where
    T: Serialize + Debug,
{
    Request(Request),
    Response(Response<T>),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Request {
    id: i64,
    method: String,
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
            method: "".to_string(),
            msg: serde_json::Value::Null,
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Response<T>
where
    T: Serialize + Debug,
{
    id: i64,
    msg: Option<Box<T>>,
    err: Option<String>,
}

impl<T> Response<T>
where
    T: Any + Serialize + Debug,
{
    pub fn error(request: Request, error: String) -> Response<T> {
        Response {
            id: request.id * -1,
            msg: None,
            err: Some(error),
        }
    }

    pub fn ok(request: Request, msg: T) -> Response<T> {
        Response {
            id: request.id * -1,
            msg: Some(Box::new(msg)),
            err: None,
        }
    }

    #[allow(dead_code)]
    pub fn to_json(&self) -> serde_json::Result<String> {
        serde_json::to_string(&self)
    }

    #[allow(dead_code)]
    pub fn empty(request: Request) -> Response<T> {
        Response {
            id: request.id,
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
    methods: HashMap<String, Rc<dyn Fn(&mut State, &Request) -> Result<T, E>>>,
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

    pub fn at(
        &mut self,
        name: &str,
        method: &'static dyn Fn(&mut State, &Request) -> Result<T, E>,
    ) {
        let rc_method = Rc::new(method);
        self.methods.insert(name.to_string(), rc_method);
    }

    pub fn stdio_loop(&mut self) {
        let stdin = io::stdin();
        // let mut stdout = io::stdout();
        let handshake = hello();
        self.send(Message::Request(handshake));

        for line in stdin.lock().lines() {
            let line = line.expect("Could not read line from standard in");
            self.recv(line)
        }
    }

    pub fn recv(&mut self, line: String) {
        // eprintln!("RECV: {}", line);
        let parsed_request = self.parse_json(&line);
        let response = match parsed_request {
            Ok(request) => self.onrequest(request),
            Err(err) => Response::error(Request::empty(), err.to_string()),
        };
        self.send(Message::Response(response))
    }

    pub fn send(&self, msg: Message<T>)
    where
        T: Serialize + Debug,
    {
        let json = match msg {
            Message::Request(ref req) => serde_json::to_string(&req),
            Message::Response(ref res) => serde_json::to_string(&res),
        };
        match json {
            Ok(str) => println!("{}", str),
            Err(_err) => eprintln!("Could not serialize message."),
        }
    }

    fn onrequest(&mut self, request: Request) -> Response<T> {
        if let Some(method) = self.methods.get(&request.method) {
            let response = method(&mut self.state, &request);
            match response {
                Ok(response) => Response::ok(request, response),
                Err(err) => Response::error(request, err.to_string()),
            }
        } else {
            Response::error(request, "Method not found.".to_string())
        }
    }

    fn parse_json(&mut self, json: &str) -> serde_json::Result<Request> {
        let request: serde_json::Result<Request> = serde_json::from_str(json);
        request
    }
}

fn hello() -> Request {
    Request {
        id: 0,
        method: "hello".to_string(),
        msg: serde_json::Value::Null,
    }
}
