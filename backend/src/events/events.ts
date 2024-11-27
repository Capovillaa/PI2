import { Request, RequestHandler, Response } from "express";
import OracleDB, { events } from "oracledb";
import dotenv from 'dotenv';
import { UserAccount } from "../Interfaces/interface";
import { Wallet } from "../Interfaces/interface";
import { Events } from "../Interfaces/interface";
import { Bet } from "../Interfaces/interface";
dotenv.config();

async function getUser(token: string,connection: OracleDB.Connection){

    let result = await connection.execute<UserAccount>(
        `SELECT *
         FROM ACCOUNTS
         WHERE TOKEN = :token`,
        {token}
    );

    let User = result.rows && result.rows[0] ? result.rows[0] : null;
    
    return User;
}

async function getWallet(id_crt: number,connection: OracleDB.Connection){

    let result = await connection.execute<Wallet>(
        `SELECT *
         FROM WALLETS
         WHERE ID_CRT = :id_crt`,
        {id_crt}
    );

    let Wallet = result.rows && result.rows[0] ? result.rows[0] : null;
    return Wallet;
}

async function getEvent(idEvento:number,connection: OracleDB.Connection){

    let result = await connection.execute<Events>(
        `SELECT *
         FROM EVENTS
         WHERE ID_EVT = :idEvento AND STATUS = 'aprovado'`,
        {idEvento}
    );

    let Event = result.rows && result.rows[0] ? result.rows[0] : null;
    return Event;
}

function hasSufficientBalance(balance:number,valorCota:number,qtdCotas:number){
    if(balance < (valorCota*qtdCotas)){
        return false;
    }
    return true;
}

async function getAllBets(IdEvt: number,connection: OracleDB.Connection){

    let result = await connection.execute<Bet>(
        `SELECT *
         FROM BETS
         WHERE FK_ID_EVT = :IdEvt`,
        [IdEvt]
    );
        //esta dupla interrogacao faz com que caso o result.rows seja nulo ou undefined ela atribui um array padrao para allBet = []
    let allBets: Bet[] = result.rows??[];
    return allBets;
}
async function geAllWinnersBets(Event: Events,ResultadoEvento: string,connection: OracleDB.Connection){
    let result = await connection.execute<Bet>(
        `SELECT *
         FROM BETS
         WHERE FK_ID_EVT = :IdEvt AND ESCOLHA = :ResultadoEvento`,
        [Event.ID_EVT, ResultadoEvento],
    );
    let allWinnersBets: Bet[] = result.rows??[];
    return allWinnersBets;
}
function getPool(allBets: Bet[],Event: Events){
    
    let pool = 0;

    for(const row of allBets){
        pool += (Event.VALOR_COTA* row.QTD_COTAS);
        
    }
    console.log(pool);
    return pool;
}

function getWinnersPool(allWinnersBets: Bet[],Event: Events){
    
    let winnersPool = 0;

    for(const row of allWinnersBets){
        winnersPool += (row.QTD_COTAS * Event.VALOR_COTA);
    }

    return winnersPool;
}
export namespace EventsManager{

    async function addNewEvent(token: string, titulo: string, descricao: string, categoria: string, 
        valorCota: number, dataHoraInicio: string, dataHoraFim: string, dataEvento: string) : Promise<OracleDB.Result<unknown>> {
        
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectionString: process.env.ORACLE_CONN_STR
            });

            let User = await getUser(token,connection);
            
            let idUsr = User?.ID_USR;

            let insertion = await connection.execute(
                `INSERT INTO EVENTS
                 (ID_EVT, FK_ID_USR, TITULO, DESCRICAO, CATEGORIA, DATA_INICIO, DATA_FIM, DATA_EVT, STATUS, VALOR_COTA)
                 VALUES
                 (SEQ_EVENTSPK.NEXTVAL, :idUsr, :titulo, :descricao, :categoria, 
                 TO_DATE(:dataHoraInicio, 'yyyy-mm-dd'), 
                 TO_DATE(:dataHoraFim, 'yyyy-mm-dd'), 
                 TO_DATE(:dataEvento, 'yyyy-mm-dd'), 
                 'em espera', :valorCota)`,
                 {idUsr, titulo, descricao, categoria, dataHoraInicio, dataHoraFim, dataEvento, valorCota},
                 {autoCommit: false}
            );
            
            await connection.commit();
            await connection.close();
            console.log("Resultados da inserção: ", insertion); 
            return(insertion);
    }

    const nodemailer = require('nodemailer');

    async function evaluateNewEvent(idEvento: number, status: string, mensagem: string) {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try {
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectionString: process.env.ORACLE_CONN_STR
            });

            let update = await connection.execute(
                `UPDATE EVENTS
                 SET STATUS = :status
                 WHERE ID_EVT = :idEvento`,
                {status, idEvento},
                {autoCommit:false}
            )

            if (status === "recusado"){
                
                interface fkIdUsrResult {
                    FK_ID_USR: number;
                };

                let resultIdUsr = await connection.execute<fkIdUsrResult>(
                    `SELECT FK_ID_USR
                     FROM EVENTS
                     WHERE ID_EVT = :idEvento`,
                    {idEvento}
                );
    
                let fkIdUsr = resultIdUsr.rows?.[0]?.FK_ID_USR;
                if (!fkIdUsr) {
                    throw new Error("Não foi encontrado o usuário criador desse email.");
                };

                interface emailUsrResult {
                    EMAIL: string;
                };

                let resultEmail = await connection.execute<emailUsrResult>(
                    `SELECT EMAIL
                     FROM ACCOUNTS
                     WHERE ID_USR = :fkIdUsr`,
                    {fkIdUsr}
                );

                let email = resultEmail.rows?.[0]?.EMAIL;
                if (!email) {
                    throw new Error("Não foi encontrado o email do usuário.")
                }

                await sendRejectionEmail(email, mensagem);
            }

            await connection.commit();
            console.log("Resultados da atualização: ", update);
        }catch (err) {
            console.error("Erro do banco de dados: ", err);
            throw new Error("Erro ao tentar atualizar o status do evento.");
        }finally {
            if (connection){
                try{
                    await connection.close();
                } catch (err) {
                    console.error("Erro ao tentar fechar a conexão: ", err);
                }
            }
        }
    }

    async function sendRejectionEmail(email: string, mensagem: string) {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            },
            logger: true,
            debug: true
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Evento Recusado',
            text: mensagem
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log("Email enviado com sucesso.");
        }catch (err) {
            console.error("Erro ao enviar o email: ", err);
        }
    }

    async function getEvents(status: string): Promise<Events[]> {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;
        try {
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });
            let sqlgetEvents = 
                `SELECT * 
                 FROM EVENTS`;
            let paramsgetEvents: any = {};
            let conditionsgetEvents: string[] = [];
            if (status) {
                console.log("Status buscado: ", status);
                conditionsgetEvents.push(`STATUS LIKE :status`);
                paramsgetEvents.status = `%${status}%`; 
            }
            if (conditionsgetEvents.length > 0) {
                sqlgetEvents += ' WHERE ' + conditionsgetEvents.join(' AND ');
            }
            
            const resultGetEvents = await connection.execute(sqlgetEvents, paramsgetEvents);
            await connection.close();
            if (resultGetEvents.rows && resultGetEvents.rows.length > 0) {
                return resultGetEvents.rows as Events[];
            } else {
                console.log ('Nenhum evento encontrado com esse status.');
                return [];
            }
        } catch (err) {
            console.error("Erro do banco de dados: ", err);
            throw new Error("Erro ao tentar buscar os eventos.");
        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (err) {
                    console.error("Erro ao tentar fechar a conexão: ", err);
                }
            }
        }
    }

    async function searchEvents(searchTerm: string | undefined): Promise<Events[]> {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try {
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            let sqlgetEvents = `SELECT ID_EVT, FK_ID_USR, TITULO, DESCRICAO, CATEGORIA, DATA_INICIO, DATA_FIM, DATA_EVT, VALOR_COTA FROM EVENTS`;
            let paramsgetEvents: any = {};
            let conditionsgetEvents: string[] = [];
            
            if (searchTerm) {
                conditionsgetEvents.push(`(UPPER(TITULO) LIKE UPPER (:termo) OR UPPER(DESCRICAO) LIKE UPPER(:termo) OR UPPER(CATEGORIA) LIKE UPPER(:termo))`);
                paramsgetEvents.termo = `%${searchTerm}%`; 
            }
            conditionsgetEvents.push (`status = 'aprovado'`);
            if (conditionsgetEvents.length > 0) {
                sqlgetEvents += ' WHERE ' + conditionsgetEvents.join(' AND ');
            }
            
            const resultGetEvents = await connection.execute(sqlgetEvents, paramsgetEvents);
            await connection.close();

            if (resultGetEvents.rows && resultGetEvents.rows.length > 0) {
                return resultGetEvents.rows as Events[];
            } else {
                console.log ('Nenhum evento encontrado com essa palavra.');
                return [];
            } 
        } catch (err) {
            console.error("Erro do banco de dados: ", err);
            throw new Error("Erro ao tentar buscar os eventos.");
        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (err) {
                    console.error("Erro ao tentar fechar a conexão: ", err);
                }
            }
        }
    }

    async function getEventsQtty() : Promise<OracleDB.Result<unknown>> {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        
        let connection = await OracleDB.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectString: process.env.ORACLE_CONN_STR
        });

        let eventsQtty = await connection.execute(
            `SELECT count(ID_EVT) as eventsQtty FROM EVENTS WHERE STATUS = 'aprovado'`
        );

        await connection.close();
        return eventsQtty;
    }

    async function getBetsByEvent(eventsQtty: OracleDB.Result<any>, connection: OracleDB.Connection) {
        interface BetCountResult {
            BETSQTTY: number;
        }
        
        const eventsWithBets = await Promise.all(
            (eventsQtty?.rows ?? []).map(async (event: any) => {
                const result = await connection.execute(
                    `SELECT count(ID_APT) as betsQtty
                     FROM BETS
                     WHERE FK_ID_EVT = :id_evt`,
                    { id_evt: event.ID_EVT }
                );
        
                const betsQtty = (result.rows?.[0] as BetCountResult)?.BETSQTTY ?? 0;
        
                return {
                    ...event,
                    betsQtty,
                };
            })
        );

        return eventsWithBets;
    }
    
    async function getEventsByPage(page: number, pageSize: number) {
        const startRecord = (page - 1) * pageSize;
    
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection: OracleDB.Connection | null = null;
    
        try {
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR,
            });
    
            // Busca eventos paginados
            const eventsQtty = await connection.execute(
                `SELECT * FROM EVENTS 
                 WHERE STATUS = 'aprovado' 
                 ORDER BY ID_EVT 
                 OFFSET :startRecord ROWS 
                 FETCH NEXT :pageSize ROWS ONLY`,
                { startRecord, pageSize }
            );
    
            if (!eventsQtty.rows || eventsQtty.rows.length === 0) {
                console.log("Nenhum dado retornado ou estrutura inválida.");
                return [];
            }
    
            // Adiciona a quantidade de apostas a cada evento
            const eventsWithBets = await getBetsByEvent(eventsQtty, connection);
    
            console.log(eventsWithBets); // Para verificar o resultado final
            return eventsWithBets; // Retorna eventos com a quantidade de apostas
        } catch (err) {
            console.error("Erro ao buscar eventos:", err);
            throw err;
        } finally {
            if (connection) {
                await connection.close(); // Certifique-se de fechar a conexão
            }
        }
    }
    
    
    async function betOnEvent(token:string,idEvento:number,qtdCotas:number,escolha:string) {

        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try{

            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            let User = await getUser(token,connection);
            let Event = await getEvent(idEvento,connection);
            
            if(User?.FK_ID_CRT){

                let Wallet = await getWallet(User?.FK_ID_CRT,connection);

                if(Wallet?.SALDO && Event?.VALOR_COTA && hasSufficientBalance(Wallet.SALDO,Event.VALOR_COTA,qtdCotas)){

                    let idUsr = User.ID_USR
                    let idCrt = User.FK_ID_CRT;
                    let idEvt = Event.ID_EVT;
                    let valorCota = Event.VALOR_COTA;
                    let balance = Wallet.SALDO;

                    let valorAposta = valorCota*qtdCotas;
                    balance -= valorAposta;

                    let update = await connection.execute(
                        `UPDATE WALLETS
                        SET SALDO = :balance
                        WHERE ID_CRT = :idCrt`,
                        {balance, idCrt},
                        {autoCommit: false}
                    );
    
                    let insertion = await connection.execute(
                        `INSERT INTO BETS
                            (ID_APT, QTD_COTAS, FK_ID_EVT, FK_ID_USR, ESCOLHA)
                        VALUES
                            (SEQ_BETSPK.NEXTVAL, :qtdCotas, :idEvt, :idUsr, :escolha)`,
                        {qtdCotas, idEvt, idUsr, escolha},
                        {autoCommit: false}
                    );

                    await connection.commit();
                    console.log("Resultados da inserção: ", insertion);
                }else{
                    throw new Error("Saldo insuficiente.");
                }
            }else{
                throw new Error("Usuário não existe.");
            }
            
        }catch(err){
            console.log("Erro do banco de dados: ", err);
            throw new Error("Erro ao tentar criar a aposta.");
        }finally{
            if (connection){
                try{
                    await connection.close();
                } catch (err) {
                    console.error("Erro ao tentar fechar a conexão: ", err);
                }
            }
        }
    }

    async function deleteEvents(idEvento:number) {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try {
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectionString: process.env.ORACLE_CONN_STR
            });

            let deletion = await connection.execute(
                `UPDATE EVENTS
                 SET STATUS = 'removido'
                 WHERE ID_EVT = :idEvento`,
                 {idEvento},
                {autoCommit:false}
            )
            await connection.commit();
            console.log("Resultados da atualização: ", deletion);
        } catch (err) {
            console.error("Erro do banco de dados: ", err);
            throw new Error("Erro ao atualizar o status do evento.");
        }finally {
            if (connection){
                try{
                    await connection.close();
                } catch (err) {
                    console.error("Erro ao tentar fechar a conexão: ", err);
                }
            }
        }
    }
    
    async function finishEvent(IdEvt: number,ResultadoEvento:string) {
        
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        
        let winnerPool:number = 0;
        try{
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            let allBets:Bet[] = await getAllBets(IdEvt,connection);
            let Event = await getEvent(IdEvt,connection);
            
            if(Event !== null){

                let pool = getPool(allBets,Event);
                let allWinnersBets = await geAllWinnersBets(Event,ResultadoEvento,connection)
                let winnersPool =  getWinnersPool(allWinnersBets,Event);
                
                for(const row of allWinnersBets){

                    interface idCrtResult {
                        FK_ID_CRT: number;
                    }

                    let FK_ID_USR = row.FK_ID_USR;
                    let resultIdCrt = await connection.execute<idCrtResult>(
                        `SELECT FK_ID_CRT
                        FROM ACCOUNTS
                        WHERE ID_USR = :FK_ID_USR`,
                        {FK_ID_USR}
                    );

                    let idCrt = resultIdCrt.rows?.[0]?.FK_ID_CRT;
                    if (!idCrt) {
                        throw new Error("Carteira do usuário não está registrada.");
                    };

                    interface balanceResult {
                        SALDO: number;
                    }
                    let resultBalance = await connection.execute<balanceResult>(
                        `SELECT SALDO
                            FROM WALLETS
                            WHERE ID_CRT = :idCrt`,
                        {idCrt}
                    );
            
                    let balance = resultBalance.rows?.[0]?.SALDO;
                    if (balance === undefined || balance === null) {
                        throw new Error("Carteira do usuário não encontrada.");
                    }

                    let valorAposta = Event.VALOR_COTA * row.QTD_COTAS;
                    let proportion = valorAposta/winnersPool;
                    let newBalance = pool * proportion;
                    balance += newBalance;

                    console.log(`Atualizando saldo da carteira ${idCrt} para ${balance}`);

                    let update = await connection.execute(
                        `UPDATE WALLETS
                            SET SALDO = :balance
                            WHERE ID_CRT = :idCrt`,
                        {balance, idCrt},
                        {autoCommit: false}
                    );
                    await connection.commit();
                }
                let updateStatus = await connection.execute(
                    `UPDATE EVENTS
                        SET STATUS = 'finalizado'
                        WHERE ID_EVT = :idEvt`,
                    {IdEvt},
                    {autoCommit: false}
                );
                await connection.commit();

            }else{
                throw new Error("Evento não Existe.");
            }    
        }catch(err){
            console.log("Erro do banco de dados: ", err);
            throw new Error("Erro ao tentar pegar a premiação do evento.");
        }finally{
            if (connection){
                try{
                    await connection.close();
                } catch (err) {
                    console.error("Erro ao tentar fechar a conexão: ", err);
                }
            }
        }
    }

    export const addNewEventHandler:RequestHandler = async (req: Request, res:Response) => {
        const pToken = req.get('Authorization');
        const pTitulo = req.get('titulo');
        const pDescricao = req.get('descricao');
        const pCategoria = req.get('categoria');
        const pValorCota = Number(req.get('valor-cota'));
        const pDataHoraInicio = req.get('data-hora-inicio');
        const pDataHoraFim = req.get('data-hora-fim');
        const pDataEvento = req.get('data-evento');

        if (pToken && pTitulo && pDescricao && pCategoria && !isNaN(pValorCota) && pDataHoraInicio && pDataHoraFim && pDataEvento){
            if (pValorCota >= 1){
                try {
                    await addNewEvent(pToken, pTitulo, pDescricao, pCategoria, pValorCota, pDataHoraInicio, pDataHoraFim, pDataEvento);
                    res.statusCode = 200;
                    res.send('Evento criado com sucesso.');
                } catch (error) {
                    res.statusCode = 500;
                    res.send('Erro ao tentar criar o evento. Tente novamente.');
                }
            } else {
                res.statusCode = 400;
                res.send('Valor mínimo da aposta não foi atingido.')
            }
        } else {
            res.statusCode = 400;
            res.send('Parâmetros inválidos ou faltantes.');
        }
    }

    export const evaluateNewEventHandler:RequestHandler = async (req: Request, res: Response) => {
        const pIdEvento = Number(req.get('id-evento'));
        const pStatus = req.get('status');
        const pMessage = req.get('mensagem');

        if (!isNaN(pIdEvento) && pStatus && pMessage){
            try {
                await evaluateNewEvent(pIdEvento, pStatus, pMessage);
                res.statusCode = 200;
                res.send('Evento avaliado com sucesso.');
            } catch (error) {
                res.statusCode = 500;
                res.send('Erro ao tentar avaliar o evento. Tente novamente.');
            }
        } else {
            res.statusCode = 400;
            res.send('Parâmetros inválidos ou faltantes.');
        }
    }

    export const getEventsHandler:RequestHandler = async (req: Request, res:Response) => {
        const pStatus = req.get('status');
        if (pStatus){
            try {
                const eventos = await getEvents(pStatus);
                if (eventos.length > 0) {
                    res.status(200).json(eventos); 
                } else {
                    res.status(404).send('Nenhum evento encontrado.'); 
                }
            } catch (error) {
                res.statusCode = 500;
                res.send('Erro ao tentar encontrar os eventos. Tente novamente.');
            }
        } else {
            res.statusCode = 400;
            res.send('Parâmetros inválidos ou faltantes.')
        }
    }

    export const searchEventsHandler:RequestHandler = async (req: Request, res: Response) => {
        const pSearchTerm = req.query.palavra as string | undefined;
    
        try {
            console.log('Parâmetro de busca: ', pSearchTerm);
            const eventos = await searchEvents(pSearchTerm); 
            if (eventos.length > 0) {
                res.status(200).json(eventos); 
            } else {
                res.statusCode = 404;
                res.send('Nenhum evento encontrado.'); 
            }
        } catch (error) {
            res.statusCode = 500;
            res.send('Erro ao tentar buscar os eventos. Tente novamente.');
        }
    }

    export const getEventsQttyHandler: RequestHandler = async(req: Request, res: Response) => {
        const eventsQtty = await getEventsQtty();
        res.statusCode = 200;
        res.send(eventsQtty.rows);
    }

    export const getEventsByPageHandler: RequestHandler = async (req: Request, res: Response) => {
        try {
            const pPage = parseInt(req.get('page') || '', 10);
            const pPageSize = parseInt(req.get('pageSize') || '', 10);

            if (isNaN(pPage) || isNaN(pPageSize) || pPage < 1 || pPageSize < 1) {
                res.status(400).send('Parâmetros inválidos ou faltantes.');
            }

            const events = await getEventsByPage(pPage, pPageSize);
            console.log(events);
            res.status(200).json(events);
        } catch (error) {
            console.error('Erro em getEventsByPageHandler:', error);
            res.status(500).send('Erro interno ao processar a solicitação.');
        }
    }

    export const betOnEventsHandler: RequestHandler = async (req : Request, res : Response) => {
        const pToken = req.get('Authorization');
        const pidEvento = parseInt(req.get('id_evento') || '0');
        const pQtdCotas = parseInt(req.get('qtd_cotas') || '0');
        const pEscolha = req.get('escolha');

        if(pToken && pidEvento && !isNaN(pQtdCotas) && pEscolha){
            if(pQtdCotas > 0){
                try{
                    await betOnEvent(pToken,pidEvento,pQtdCotas,pEscolha);
                    res.statusCode = 200;
                    res.send('Aposta realizada com sucesso.');
                }catch(err){
                    res.statusCode = 500;
                    res.send('Erro ao tentar realizar a aposta.');
                }
            }else{
                res.statusCode = 400;
                res.send('Parâmetros inválidos ou faltantes.')
            }
        }else{
            res.statusCode = 400;
            res.send('Parâmetros inválidos ou faltantes.')
        }
    }

    export const deleteEventsHandler:RequestHandler = async (req: Request, res: Response) => {
        const pIdEvento = Number(req.get('id-evento'));

        if (!isNaN(pIdEvento)){
            try {
                await deleteEvents(pIdEvento);
                res.statusCode = 200;
                res.send('Evento removido com sucesso.')
            } catch (error) {
                res.statusCode = 500;
                res.send('Erro ao tentar remover o evento. Tente novamente.');
            }
        } else {
            res.statusCode = 400;
            res.send('Parâmetros inválidos ou faltantes.');
        }
    }

    export const finishEventHandler: RequestHandler = async (req : Request, res : Response) => {
        const pIdAdmin = parseInt(req.get('id_admin') || '0');
        const pIdEvt = parseInt(req.get('id_evt') || '0');
        const pResultadoEvento = req.get('resultado')?.toLowerCase();

        if(!isNaN(pIdAdmin) && !isNaN(pIdEvt) && pResultadoEvento){
            try {
                await finishEvent(pIdEvt,pResultadoEvento);
                res.statusCode = 200;
                res.send('Evento finalizado com sucesso.');
            } catch (error) {
                res.statusCode = 500;
                res.send('Erro ao tentar finalizar evento. Tente novamente.')
            }
        }else{
            res.statusCode = 400;
            res.send('Parâmetros inválidos ou faltantes.');
        }
    }
}
