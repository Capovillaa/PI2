import express from "express";
import {Request, Response, Router} from "express";
import { AccountsManager } from "./accounts/accounts";
import { FinancialManager } from "./financial/financial";

const port = 3000; 
const server = express();
const routes = Router();


routes.get('/', (req: Request, res: Response)=>{
    res.statusCode = 403;
    res.send('Acesso não permitido. Rota default não disponivel.');
});

routes.put('/signUp', AccountsManager.signUpRouteHandler);

routes.post('/getWalletBalance',FinancialManager.getWalletBalanceHandler);

server.use(routes);

server.listen(port, ()=>{
    console.log(`Server is running on: ${port}`);
})