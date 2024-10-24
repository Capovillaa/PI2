import express from "express";
import {Request, Response, Router} from "express";
import { AccountsManager } from "./accounts/accounts";
import { getLoginAuthenticatorHandler} from "./accounts/loginAuthenticator"; 
import { EventsManager} from "./events/eventsDuda";
import { FinancialManager } from "./financial/addfunds";
import { betOnEventsHandler } from "./events/betOnEvent";

const port = 3000; 
const server = express();
const routes = Router();



routes.get('/', (req: Request, res: Response)=>{
    res.statusCode = 403;
    res.send('Acesso não permitido. Rota default não disponivel.');
});

routes.put('/signUp', AccountsManager.signUpHandler);
routes.put('/login', getLoginAuthenticatorHandler);

routes.get('/getEvents', EventsManager.getEventosHandler);
routes.post('/addFunds', FinancialManager.addFundsHandler);
routes.post('/withdrawFunds', FinancialManager.withdrawFundsHandler);

routes.post('/betOnEvent',betOnEventsHandler);
server.use(routes);

server.listen(port, ()=>{
    console.log(`Server is running on: ${port}`);
})