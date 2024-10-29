import { Request, RequestHandler, Response } from "express";
import OracleDB from "oracledb";
import dotenv from 'dotenv'; 
dotenv.config();

export type Event = {
    id_evento: number | undefined; 
    id_usuario: number;            
    titulo: string;                 
    descricao: string;
    categoria: string;
    valor_cota: number;             
    data_hora_inicio: string;        
    data_hora_fim: string;          
    data_evento: string;              
    status_evento: string;          
};

function validateEmail(email: string) :boolean{
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export namespace EventsManager{
    async function addNewEvent(email: string, titulo: string, descricao: string, categoria: string, 
    valorCota: number, dataHoraInicio: string, dataHoraFim: string, dataEvento: string) {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try {
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectionString: process.env.ORACLE_CONN_STR
            });

            interface AccountResult {
                ID_USR: number;
            }

            let resultIdUsr = await connection.execute<AccountResult>(
                `SELECT ID_USR
                 FROM ACCOUNTS
                 WHERE EMAIL = :email`,
                {email}
            );

            let idUsr = resultIdUsr.rows?.[0]?.ID_USR;
            if (!idUsr) {
                throw new Error("Usuário com este email não encontrado.");
            }

            let insertion = await connection.execute(
                `INSERT INTO EVENTS
                 (ID_EVT, FK_ID_USR, TITULO, DESCRICAO, CATEGORIA, DATA_INICIO, DATA_FIM, DATA_EVT, STATUS, VALOR_COTA)
                 VALUES
                 (SEQ_EVENTSPK.NEXTVAL, :idUsr, :titulo, :descricao, :categoria, 
                 TO_DATE(:dataHoraInicio, 'yyyy/mm/dd hh24:mi:ss'), 
                 TO_DATE(:dataHoraFim, 'yyyy/mm/dd hh24:mi:ss'), 
                 TO_DATE(:dataEvento, 'YYYY-MM-DD'), 
                 'em espera', :valorCota)`,
                 {idUsr, titulo, descricao, categoria, dataHoraInicio, dataHoraFim, dataEvento, valorCota},
                 {autoCommit: false}
            );
            await connection.commit();
            console.log("Resultados da inserção: ", insertion);

        }catch (err) {
            console.error("Erro do banco de dados: ", err);
            throw new Error("Erro ao registrar o evento.");
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

    async function evaluateNewEvent(idEvento: number, status: string) {
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
            await connection.commit();
            console.log("Resultados da atualização: ", update);
        }catch (err) {
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

    interface GetEvent {
        ID_EVENTO: number;
        FK_ID_USR: number;
        TITULO: string;
        DESCRICAO: string;
        CATEGORIA: string;
        DATA_INICIO: Date;
        DATA_FIM: Date;
        DATA_EVENTO: Date;
        STATUS: string;
    }

    async function getEvents(status: string): Promise<GetEvent[]> {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;
        try {
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });
            let sqlgetEvents = `SELECT ID_EVT, FK_ID_USR, TITULO, DESCRICAO, CATEGORIA, DATA_INICIO, DATA_FIM, DATA_EVT, STATUS, VALOR_COTA FROM EVENTS`;
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
                return resultGetEvents.rows as GetEvent[];
            } else {
                console.log ('Nenhum evento encontrado com esse status.');
                return [];
            }
        } catch (err) {
            console.error("Database error: ", err);
            throw new Error("Error during event retrieval");
        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (err) {
                    console.error("Error closing the connection: ", err);
                }
            }
        }
    }

    async function searchEvents(searchTerm: string | undefined): Promise<GetEvent[]> {
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
                return resultGetEvents.rows as GetEvent[];
            } else {
                console.log ('Nenhum evento encontrado com essa palavra.');
                return [];
            } 
        } catch (err) {
            console.error("Database error: ", err);
            throw new Error("Error during event retrieval");
        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (err) {
                    console.error("Error closing the connection: ", err);
                }
            }
        }
    }

    async function betOnEvent(email:string,tituloEvento:string,qtdCotas:number,escolha:string) {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try{

            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            interface idUsrResult{
                ID_USR: number;
            }

            interface idCrtResult {
                FK_ID_CRT: number;
            }

            interface balanceResult {
                SALDO: number;
            }

            interface idEventResult {
                ID_EVT: number;
            }

            interface valorCotasResult{
                VALOR_COTA: number;
            }

            let resultIdUsr = await connection.execute<idUsrResult>(
                `SELECT ID_USR
                 FROM ACCOUNTS
                 WHERE EMAIL = :email`,
                {email}
            );

            let idUsr = resultIdUsr.rows?.[0]?.ID_USR;
            if (!idUsr) {
                throw new Error("Usuário com este email não encontrado.");
            };

            let resultIdCrt = await connection.execute<idCrtResult>(
                `SELECT FK_ID_CRT
                 FROM ACCOUNTS
                 WHERE ID_USR = :idUsr`,
                {idUsr}
            );

            let idCrt = resultIdCrt.rows?.[0]?.FK_ID_CRT;
            if (!idCrt) {
                throw new Error("Usuário com este id.");
            };

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

            let resultIdEvent = await connection.execute<idEventResult>(
                `SELECT ID_EVT
                 FROM EVENTS
                 WHERE TITULO = :tituloEvento`,
                {tituloEvento}
            );

            let idEvt = resultIdEvent.rows?.[0]?.ID_EVT;
            if (!idEvt) {
                throw new Error("Evento com este Titulo não encontrado.");
            };

            let resultValorCota = await connection.execute<valorCotasResult>(
                `SELECT VALOR_COTA
                 FROM EVENTS
                 WHERE ID_EVT = :idEvt`,
                {idEvt}
            );

            let valorCota = resultValorCota.rows?.[0]?.VALOR_COTA;
            if (!valorCota) {
                throw new Error("Evento com parametro faltante.");
            };

            if(balance < (valorCota*qtdCotas)){
                throw new Error("Saldo insuficiente.");
            }

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
            console.log("Insertion results: ", insertion);
        

        }catch(err){
            console.log('DataBase error',err);
            throw new Error("Error during bet");
        }finally{
            if (connection){
                try{
                    await connection.close();
                } catch (err) {
                    console.error("Error closing the connection: ", err);
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
            console.log("Resultados da remoção: ", deletion);
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

        let pool:number = 0;
        let winnerPool:number = 0;
        try{
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            interface Bet {
                ID_APT: number;
                QTD_COTAS: number;
                FK_ID_EVT: number;
                FK_ID_USR: number;
                ESCOLHA: string;
            }

            interface valorCotasResult{
                VALOR_COTA: number;
            }

            const allBets = await connection.execute<Bet>(
                `SELECT *
                 FROM BETS
                 WHERE FK_ID_EVT = :IdEvt`,
                [IdEvt],
                { outFormat: OracleDB.OUT_FORMAT_OBJECT }
            );

            let resultValorCota = await connection.execute<valorCotasResult>(
                `SELECT VALOR_COTA
                 FROM EVENTS
                 WHERE ID_EVT = :IdEvt`,
                {IdEvt}
            );

            let valorCota = resultValorCota.rows?.[0]?.VALOR_COTA;
            if (!valorCota) {
                throw new Error("Evento com parametro faltante.");
            };

            //rows: [{ ID_APT: 1, QTD_COTAS: ? , FK_ID_EVT: ?,FK_ID_USR: ?,ESCOLHA: ? }]

            if(allBets.rows && allBets.rows.length > 0){
                for(const row of allBets.rows){
                    let QTD_COTAS: number = row.QTD_COTAS as number;
                    pool += (QTD_COTAS * valorCota);
                }
                console.log(pool);
            }else{
                throw new Error("Nenhuma linha encontrada.");
            }

            const allWinnersBets = await connection.execute<Bet>(
                `SELECT *
                 FROM BETS
                 WHERE FK_ID_EVT = :IdEvt AND ESCOLHA = :ResultadoEvento`,
                [IdEvt, ResultadoEvento],
                { outFormat: OracleDB.OUT_FORMAT_OBJECT }
            );

            if(allWinnersBets.rows && allWinnersBets.rows.length > 0){
                for(const row of allWinnersBets.rows){
                    let QTD_COTAS: number = row.QTD_COTAS as number;
                    winnerPool += (QTD_COTAS * valorCota);
                }
                console.log(winnerPool);
            }else{
                throw new Error("Nenhuma linha encontrada.");
            }

            if(allWinnersBets.rows && allWinnersBets.rows.length > 0){
                for(const row of allWinnersBets.rows){
                    let QTD_COTAS: number = row.QTD_COTAS as number;
                    let FK_ID_USR: number = row.FK_ID_USR as number;

                    interface idCrtResult {
                        FK_ID_CRT: number;
                    }

                    interface balanceResult {
                        SALDO: number;
                    }

                    let resultIdCrt = await connection.execute<idCrtResult>(
                        `SELECT FK_ID_CRT
                         FROM ACCOUNTS
                         WHERE ID_USR = :FK_ID_USR`,
                        {FK_ID_USR}
                    );

                    let idCrt = resultIdCrt.rows?.[0]?.FK_ID_CRT;
                    if (!idCrt) {
                        throw new Error("Usuário com este id.");
                    };
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

                    let valorAposta = valorCota * QTD_COTAS;
                    let proportion = valorAposta/winnerPool;
                    let newBalance = pool * proportion;
                    balance += newBalance;

                    console.log('Updating wallet with values:', {balance, idCrt});

                    let update = await connection.execute(
                        `UPDATE WALLETS
                         SET SALDO = :balance
                         WHERE ID_CRT = :idCrt`,
                        {balance, idCrt},
                        {autoCommit: false}
                    );
                    await connection.commit();

                }
            }else{
                throw new Error("Nenhuma linha encontrada.");
            }

            let updateStatus = await connection.execute(
                `UPDATE EVENTS
                 SET STATUS = 'finalizado'
                 WHERE ID_EVT = :idEvt`,
                {IdEvt},
                {autoCommit: false}
            );
            await connection.commit();
        }catch(err){
            console.log('DataBase error',err);
            throw new Error("Error during geting event Pool.");
        }finally{
            if (connection){
                try{
                    await connection.close();
                } catch (err) {
                    console.error("Error closing the connection: ", err);
                }
            }
        }
    }

    export const addNewEventHandler:RequestHandler = async (req: Request, res:Response) => {
        const pEmail = req.get('email');
        const pTitulo = req.get('titulo');
        const pDescricao = req.get('descricao');
        const pCategoria = req.get('categoria');
        const pValorCota = Number(req.get('valor-cota'));
        const pDataHoraInicio = req.get('data-hora-inicio'); //Verificar se está correto
        const pDataHoraFim = req.get('data-hora-fim');
        const pDataEvento = req.get('data-evento');

        if (pEmail && pTitulo && pDescricao && pCategoria && !isNaN(pValorCota) && pDataHoraInicio && pDataHoraFim && pDataEvento){
            if (pValorCota >= 1){
                try {
                    await addNewEvent(pEmail, pTitulo, pDescricao, pCategoria, pValorCota, pDataHoraInicio, pDataHoraFim, pDataEvento);
                    res.statusCode = 200;
                    res.send('Evento criado com sucesso.');
                } catch (error) {
                    res.statusCode = 500;
                    res.send('Erro ao criar o evento. Tente novamente.');
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

        if (!isNaN(pIdEvento) && pStatus){
            try {
                await evaluateNewEvent(pIdEvento, pStatus);
                res.statusCode = 200;
                res.send('Evento avaliado com sucesso.');
            } catch (error) {
                res.statusCode = 500;
                res.send('Erro ao avaliar o evento. Tente novamente.');
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
                    res.status(404).send("Nenhum evento encontrado."); 
                }
            } catch (error) {
                res.statusCode = 500;
                res.send('Erro ao encontrar os eventos. Tente novamente.');
            }
        } else {
            res.statusCode = 400;
            res.send('Parametros invalidos.')
        }
    }

    export const searchEventsHandler:RequestHandler = async (req: Request, res: Response) => {
        const pSearchTerm = req.query.palavra as string | undefined;
    
        try {
            console.log("Parâmetro de busca: ", pSearchTerm);
            const eventos = await searchEvents(pSearchTerm); 
            if (eventos.length > 0) {
                res.status(200).json(eventos); 
            } else {
                res.status(404).send("Nenhum evento encontrado."); 
            }
        } catch (error) {
            console.error("Erro ao buscar eventos: ", error); 
            res.status(500).send("Erro interno do servidor."); 
        }
    }

    export const betOnEventsHandler: RequestHandler = async (req : Request, res : Response) => {
        const pEmail = req.get('email');
        const pTituloEvento = req.get('titulo-evento');
        const pQtdCotas = Number(req.get('qtd-cotas'));
        const pEscolha = req.get('escolha');

        if(pEmail && pTituloEvento && !isNaN(pQtdCotas) && pEscolha){
            if(validateEmail(pEmail) && pQtdCotas > 0){
                try{
                    await betOnEvent(pEmail,pTituloEvento,pQtdCotas,pEscolha);
                    res.statusCode = 200;
                    res.send('Bet adicionada com sucesso.');
                }catch(err){
                    res.statusCode = 500;
                    res.send('Erro ao realizar a aposta.');
                }
            }else{
                res.statusCode = 400;
                res.send('Parâmetros inválidos')
            }
        }else{
            res.statusCode = 400;
            res.send('Requisição inválida - Parâmetros inválidos')
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
                res.send('Erro ao remover o evento. Tente novamente.');
            }
        } else {
            res.statusCode = 400;
            res.send('Parâmetros inválidos ou faltantes.');
        }
    }

    export const finishEventHandler: RequestHandler = async (req : Request, res : Response) => {
        const pIdAdmin = Number(req.get('id_admin'));
        const pIdEvt = Number(req.get('id_evt'));
        const pResultadoEvento = req.get('resultado')?.toLowerCase();

        if(!isNaN(pIdAdmin) && !isNaN(pIdEvt) && pResultadoEvento){
            try {
                await finishEvent(pIdEvt,pResultadoEvento);
                res.statusCode = 200;
                res.send('Evento finalizado com sucesso.');
            } catch (error) {
                res.statusCode = 500;
                res.send('Erro ao finalizar evento. Tente novamente.')
            }
        }else{
            res.statusCode = 400;
            res.send('Requisição inválida - Parâmetros faltantes');
        }
    }
}
