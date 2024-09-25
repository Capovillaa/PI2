import http from "http";

const port = 3000;

type Credencial = {
    email:string;
    senha:string;
};

function autenticar(c:Credencial):boolean{
    if (c.email === "eduardo.fg1@puccampinas.edu.br" &&
        c.senha === "SenhaForte123"){
            return true;
        } else {
            return false;
        }
};

const cred1:Credencial = {
    email: "dududuefu.gomes@gmail.com",
    senha: "SenhaForte123"
};

const cred2:Credencial = {
    email: "eduardo.fg1@puccampinas.edu.br",
    senha: "SenhaForte123"
};

var res1:boolean = autenticar(cred1);
var res2:boolean = autenticar(cred2);

//Toda resposta tem 2 partes: Cabeçalho (head) e corpo (body)
const server = http.createServer((req, res)=>{
    if (req.method === "GET"){
        if (req.url === "/login/1"){
            if (res1 === true){
                res.writeHead(200, {'content-type':'text/plain'});
                res.end(`Credencial 1 correta: ${cred1.email}`);
            } else {
                res.writeHead(200, {'content-type':'text/plain'});
                res.end(`Credencial 1 incorreta: ${cred1.email}`)
            }
        } else {
            res.writeHead(404,{'content-type':'text/plain'});
            res.end('Servico inexistente.');
        }
    } else 
    if (req.method === "POST") {
        if (req.url === "/login/2"){
            if (res2 === true){
                res.writeHead(200, {'content-type':'text/plain'});
                res.end(`Credencial 2 correta: ${cred2.email}`);
            } else {
                res.writeHead(200, {'content-type':'text/plain'});
                res.end(`Credencial 2 incorreta: ${cred2.email}`)
            }
        } else {
            res.writeHead(404,{'content-type':'text/plain'});
            res.end('Servico inexistente.');
        }
    } else {
        res.writeHead(405,{'content-type':'text/plain'});
        res.end('Metodo HTTP não permitido.');
    }
    
});

server.listen(port,()=>{
    console.log(`Servidor rodando na porta ${port}`);
});