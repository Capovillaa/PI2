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

            let idCrt = Number(await connection.execute(
                `SELECT FK_ID_CRT
                FROM ACCOUNTS
                WHERE EMAIL = :email`,
                {email}
            ));

            if(await connection.execute(
                `SELECT NUM_CARD
                FROM CREDIT_CARD
                WHERE FK_ID_CRT = :idCrt`,
                {idCrt} 
            ) === undefined){
                let insertion = await connection.execute(
                    `INSERT INTO CREDIT_CARD
                        (NUM_CARD,CVV,VALIDADE,FK_ID_CRT)
                    VALUES
                        (:cardNumber,:cvv,:expirationDate,:IdCrt)`,
                    {cardNumber,cvv,expirationDate,idCrt},
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

            let Id = Number(await connection.execute(
                `SELECT ID_USR
                FROM ACCOUNTS
                WHERE EMAIL = :email`,
                {email}
            ));

            let balance = Number(await connection.execute(
                `SELECT WALLETS.SALDO
                FROM WALLETS
                JOIN ACCOUNTS
                ON WALLETS.ID_CRT = ACCOUNTS.FK_ID_CRT
                WHERE ID = :Id`,
                {Id}
            ));

            balance += valor;
            
            let insertion = await connection.execute(
                `INSERT INTO WALLETS
                    (SALDO)
                VALUES
                    (:balance)`,
                {balance},
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
        const pCardOwner = req.get('nome-titular');
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