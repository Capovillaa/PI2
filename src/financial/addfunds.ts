import {Request,Response,RequestHandler} from "express";
import OracleDB from "oracledb";
import dotenv from "dotenv";
dotenv.config();

export namespace FinancialManager{

    async function addCreditCard(email:string,cardNumber:number,cvv:number,expirationDate:string){
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try{
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            interface AccountResult {
                FK_ID_CRT: number;
            }

            let result = await connection.execute<AccountResult>(
                `SELECT FK_ID_CRT
                 FROM ACCOUNTS
                 WHERE EMAIL = :email`,
                {email}
            );
            
            let idCrt = result.rows?.[0]?.FK_ID_CRT;
            if (!idCrt) {
                throw new Error("Usuário com este email não encontrado.");
            }

            let cardExists = await connection.execute(
                `SELECT NUM_CARD
                 FROM CREDIT_CARD
                 WHERE FK_ID_CRT = :idCrt`,
                {idCrt}
            );
            
            if (cardExists && cardExists.rows && cardExists.rows.length === 0) {
                let insertion = await connection.execute(
                `INSERT INTO CREDIT_CARD
                (NUM_CARD, CVV, VALIDADE, FK_ID_CRT)
                VALUES
                (:cardNumber, :cvv, :expirationDate, :idCrt)`,
                {cardNumber, cvv, expirationDate, idCrt},
                {autoCommit: false}
                );
                await connection.commit();
                console.log("Insertion results: ", insertion);
            }
        }catch (err) {
            console.error("Database error: ", err);
            throw new Error("Error registering credit card");
        }finally {
            if (connection){
                try{
                    await connection.close();
                } catch (err) {
                    console.error("Error closing the connection: ", err);
                }
            }
        }
    }

    async function addFunds(email: string, valor: number){
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try{
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            interface idResult {
                FK_ID_CRT: number;
            }

            interface balanceResult {
                SALDO: number;
            }

            let resultId = await connection.execute<idResult>(
                `SELECT FK_ID_CRT
                 FROM ACCOUNTS
                 WHERE EMAIL = :email`,
                {email}
            );

            let idCrt = resultId.rows?.[0]?.FK_ID_CRT;
            if (!idCrt) {
                throw new Error("Usuário com este email não encontrado.");
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

            balance += valor;
            
            let insertion = await connection.execute(
                `UPDATE WALLETS
                 SET SALDO = :balance
                 WHERE ID_CRT = :idCrt`,
                {balance, idCrt},
                {autoCommit: false}
            );

            await connection.commit();
            console.log("Insertion results: ", insertion);
     
        }catch (err) {
            console.error("Database error: ", err);
            throw new Error("Error during credit debiting");
        }finally {
            if (connection){
                try{
                    await connection.close();
                } catch (err) {
                    console.error("Error closing the connection: ", err);
                }
            }
        }
    }

    export const addFundsHandler:RequestHandler = async (req:Request, res:Response) => {
        const pEmail = req.get('email');
        const pValor = Number(req.get('valor'));
        const pCardNumber = Number(req.get('numero-cartao'));
        const pCvv = Number(req.get('cvv'));
        const pExpirationDate = req.get('validade');
        if (pEmail && !isNaN(pValor) && !isNaN(pCardNumber) && !isNaN(pCvv) && pExpirationDate){
            try {
                await addCreditCard(pEmail,pCardNumber,pCvv,pExpirationDate);
                await addFunds(pEmail,pValor);
                res.statusCode = 200;
                res.send('Crédito Adicionado Com sucesso.');
            } catch (error) {
                res.statusCode = 500;
                res.send('Erro ao colocar crédito na conta. Tente novamente.');
            }
        } else {
            res.statusCode = 400;
            res.send('Parametros invalidos ou faltantes.');
        }

    }
}