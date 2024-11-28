import express from "express";
import { Request, Response, Router } from "express";
import cors from "cors";
import { AccountsManager } from "./accounts/accounts";
import { EventsManager } from "./events/events";
import { FinancialManager } from "./financial/financial";

const port = 3000;
const server = express();
const routes = Router();

server.use(cors());

routes.get('/', (req: Request, res: Response) => {
    res.statusCode = 403;
    res.send('Acesso não permitido. Rota default não disponivel.');
});

// Accounts
routes.put('/signUp', AccountsManager.signUpHandler);
routes.post('/login', AccountsManager.loginAuthenticatorHandler);

// Financial
routes.get('/getSaldo', FinancialManager.getSaldoHandler);
routes.post('/addFunds', FinancialManager.addFundsHandler);
routes.post('/withdrawFunds', FinancialManager.withdrawFundsHandler);
routes.get('/getTransactionsQtty',FinancialManager.getTransactionsQttyHandler);
routes.post('/getTransactionsByPage', FinancialManager.getTransactionsByPageHandler);
// Events
routes.put('/addNewEvent', EventsManager.addNewEventHandler);
routes.post('/evaluateNewEvent', EventsManager.evaluateNewEventHandler);
routes.get('/getEvents', EventsManager.getEventsHandler);
routes.post('/searchEventsByPage', EventsManager.getEventsByPageHandler);
routes.get('/getEventsQtty', EventsManager.getEventsQttyHandler);
routes.post('/getEventsByPage', EventsManager.getEventsByPageHandler);
routes.post('/deleteEvent', EventsManager.deleteEventsHandler);
routes.post('/betOnEvent', EventsManager.betOnEventsHandler);
routes.post('/finishEvent', EventsManager.finishEventHandler);
routes.post('/getBetsByPage',EventsManager.getBetsByPageHandler);
routes.get('/getBetsQtty',EventsManager.getBetsQttyHandler);

server.use(routes);

server.listen(port, () => {
    console.log(`Servidor rodando na porta: ${port}`);
});
