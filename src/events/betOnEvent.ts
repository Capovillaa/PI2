import {Request,Response,RequestHandler} from "express";
import OracleDB from "oracledb";
import dotenv from "dotenv";
dotenv.config();

async function BetOnEvent(email:string,tituloEvento:string,qtdCotas:number,escolha:string) {
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
                (ID_APT,QTD_COTAS,FK_ID_EVT,FK_ID_USR,ESCOLHA)
            VALUES
                (SEQ_BETSPK.NEXTVAL,:qtdCotas,SEQ_EVENTSFK.NEXTVAL,:idUsr,:escolha)`,
            {qtdCotas,escolha,idUsr},
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
export const betOnEventsHandler: RequestHandler = async (req : Request, res : Response) => {
    const pEmail = req.get('email');
    const pTituloEvento = req.get('titulo-evento');
    const pQtdCotas = Number(req.get('qtd-cotas'));
    const pEscolha = req.get('escolha');
    if(pEmail && pTituloEvento && !isNaN(pQtdCotas) && pEscolha){
        try{
            await BetOnEvent(pEmail,pTituloEvento,pQtdCotas,pEscolha);
            res.statusCode = 200;
            res.send('Bet adicionada com sucesso.');
        }catch(err){
            res.statusCode = 500;
            res.send('Erro ao realizar a aposta.');
        }
    }else{
        res.statusCode = 400;
        res.send('Requisição inválida - Parâmetros inválidos')
    }
}