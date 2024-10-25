import {Request,Response,RequestHandler} from "express";
import OracleDB from "oracledb";
import dotenv from "dotenv";
import { error } from "console";
dotenv.config();

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
 
export const finishEventHandler: RequestHandler = async (req : Request, res : Response) => {
    const pIdAdmin = Number(req.get('id_admin'));
    const pStatus = req.get('status');
    const pIdEvt = Number(req.get('id_evt'));
    const pResultadoEvento = req.get('resultado')?.toLowerCase();

    if(!isNaN(pIdAdmin) && pStatus && !isNaN(pIdEvt) && pResultadoEvento){
        await finishEvent(pIdEvt,pResultadoEvento);
        res.statusCode = 200;
        res.send('Evento finalizado com sucesso.');
    }else{
        res.statusCode = 400;
        res.send('Requisição inválida - Parâmetros faltantes');
    }
}