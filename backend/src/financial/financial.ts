import {Request,Response,RequestHandler} from "express";
import { UserAccount } from "../Interfaces/interface";
import { Wallet } from "../Interfaces/interface";
import OracleDB from "oracledb";
import bcrypt from 'bcryptjs';
import dotenv from "dotenv";
dotenv.config();

export namespace FinancialManager{

    function validateCardNumber(cardNumber:number,cvv:number,expirationDate:string) :boolean{
        const expirationDateRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;     
        if(cardNumber > 9999999999999 && cardNumber < 10000000000000000 && cvv > 99 && cvv < 1000 && expirationDateRegex.test(expirationDate)){
            return true;
        }
        return false;
    }

    async function getSaldo(token:string){
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;
        try {
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });
            
            let resultUser = await connection.execute<UserAccount>(
                `SELECT *
                 FROM ACCOUNTS
                 WHERE TOKEN = :token`,
                {token}
            );

            let User = resultUser.rows && resultUser.rows[0] ? resultUser.rows[0] : null;

            let fkIdCrt = User?.FK_ID_CRT;

            let resultWallet = await connection.execute<Wallet>(
                `SELECT *
                 FROM WALLETS
                 WHERE ID_CRT = :fkidcrt`,
                {fkIdCrt}
            )

            let Wallet = resultWallet.rows && resultWallet.rows[0] ? resultWallet.rows[0] : null;

            let saldo = Wallet?.SALDO;

            return saldo;
        } catch (error) {
            console.error("Erro do banco de dados: ", error);
            throw new Error("Erro ao buscar saldo na carteira.");
        } finally {
            if (connection){
                try{
                    await connection.close();
                } catch (err) {
                    console.error("Erro ao tentar fechar a conexão: ", err);
                }
            }
        }
    }

    async function addCreditCard(token:string,cardNumber:number,cvv:number,expirationDate:string){
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
                 WHERE TOKEN = :token`,
                {token}
            );
            
            let idCrt = result.rows?.[0]?.FK_ID_CRT;
            if (!idCrt) {
                throw new Error("Não existe nenhum usuário com este email.");
            }

            let cardExists = await connection.execute(
                `SELECT NUM_CARD
                 FROM CREDIT_CARD
                 WHERE NUM_CARD = :cardNumber`,
                {cardNumber}
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
                console.log("Resultados da inserção: ", insertion);
            }
        }catch (err) {
            console.error("Erro do banco de dados: ", err);
            throw new Error("Erro ao tentar registrar o cartão de crédito.");
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

    async function addFunds(token: string, valor: number){
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try{
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            let result = await connection.execute<UserAccount>(
                `SELECT *
                 FROM ACCOUNTS
                 WHERE TOKEN = :token`,
                {token}
            );

            let User = result.rows && result.rows[0] ? result.rows[0] : null;

            let idCrt = User?.FK_ID_CRT;

            let resultWallet = await connection.execute<Wallet>(
                `SELECT *
                 FROM WALLETS
                 WHERE ID_CRT = :idCrt`,
                {idCrt}
            );

            let Wallet = resultWallet.rows && resultWallet.rows[0] ? resultWallet.rows[0] : null;

            let balance = Wallet?.SALDO ?? 0;
            balance += valor;

            let update = await connection.execute(
                `UPDATE WALLETS
                 SET SALDO = :balance
                 WHERE ID_CRT = :idCrt`,
                {balance, idCrt},
                {autoCommit: false}
            );
            await connection.commit();

            console.log("Resultados da atualização: ", update);
        }catch (err) {
            console.error("Erro ao tentar adicionar fundos à carteira: ", err);
        }finally {
            if (connection){
                try{
                    await connection.close();
                } catch (error) {
                    console.error("Erro ao tentar fechar a conexão: ", error);
                }
            }
        }
    }

    async function addTransaction(token: string, valor: number,tipo :string){
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try{
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            let result = await connection.execute<UserAccount>(
                `SELECT *
                 FROM ACCOUNTS
                 WHERE TOKEN = :token`,
                {token}
            );

            let User = result.rows && result.rows[0] ? result.rows[0] : null;

            let fk_id_usr = User?.ID_USR;

            let insertion = await connection.execute(
                `INSERT INTO TRANSACTIONS
                    (ID_TRS,TIPO,DATA_TRS,VALOR,FK_ID_USR)
                VALUES
                    (SEQ_TRANSACTIONSPK.NEXTVAL,:tipo,TO_CHAR(SYSDATE, 'YYYY-MM-DD'),:valor,:fk_id_usr)`,
                {tipo,valor,fk_id_usr},
                {autoCommit: false}
            );
            await connection.commit();
            
        }catch(error){
            console.error("Erro ao tentar adicionar fundos à carteira: ", error);
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

    async function withdrawFunds(token: string, valor: number): Promise<number> {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try{
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            let valorTaxado: number = 0;

            let result = await connection.execute<UserAccount>(
                `SELECT *
                 FROM ACCOUNTS
                 WHERE TOKEN = :token`,
                {token}
            );

            let User = result.rows && result.rows[0] ? result.rows[0] : null;

            let idCrt = User?.FK_ID_CRT;

            let resultWallet = await connection.execute<Wallet>(
                `SELECT *
                 FROM WALLETS
                 WHERE ID_CRT = :idCrt`,
                {idCrt}
            );

            let Wallet = resultWallet.rows && resultWallet.rows[0] ? resultWallet.rows[0] : null;

            let balance = Wallet?.SALDO;

            if (balance === undefined || balance === null) {
                throw new Error("Sem saldo na conta.");
            }

            if (valor > balance){
                throw new Error("Saldo em conta é menor que o valor que se deseja sacar.");
            }

            if (valor <= 100){
                valorTaxado = valor - (valor / 25);
            } else if (valor <= 1000){
                valorTaxado = valor - (valor / 100 * 3);
            } else if (valor <= 5000){
                valorTaxado = valor - (valor / 50);
            } else if (valor <= 100000){
                valorTaxado = valor - (valor / 100);
            } else {
                valorTaxado = valor;
            }

            balance -= valor;

            let update = await connection.execute(
                `UPDATE WALLETS
                 SET SALDO = :balance
                 WHERE ID_CRT = :idCrt`,
                {balance, idCrt},
                {autoCommit: false}
            )

            await connection.commit();
            console.log("Resultados da atualização: ", update);

            return valorTaxado;

        }catch (err) {
            console.error("Erro do banco de dados: ", err);
            throw new Error("Erro ao tentar sacar o dinheiro.");
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

    async function getTransactionsQtty(token :string) : Promise<OracleDB.Result<unknown>> {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        
        let connection = await OracleDB.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectString: process.env.ORACLE_CONN_STR
        });

        let result = await connection.execute<UserAccount>(
            `SELECT *
             FROM ACCOUNTS
             WHERE TOKEN = :token`,
            {token}
        );

        let User = result.rows && result.rows[0] ? result.rows[0] : null;
        let fk_id_usr = User?.ID_USR;

        let transactionsQtty = await connection.execute(
            `SELECT count(ID_TRS) as transactionsQtty FROM TRANSACTIONS WHERE FK_ID_USR = :fk_id_usr`,
            {fk_id_usr}
        );

        await connection.close();
        return transactionsQtty;
    }

    async function getTransactionsByPage(token: string,page: number, pageSize: number) {
        const startRecord = (page - 1) * pageSize;
    
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection: OracleDB.Connection | null = null;
    
        try {
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR,
            });
            
            let result = await connection.execute<UserAccount>(
                `SELECT *
                 FROM ACCOUNTS
                 WHERE TOKEN = :token`,
                {token}
            );

            let User = result.rows && result.rows[0] ? result.rows[0] : null;
            let fk_id_usr = User?.ID_USR;

            // Busca eventos paginados
            const transactionsQtty = await connection.execute(
                `SELECT * FROM TRANSACTIONS
                 WHERE FK_ID_USR = :fk_id_usr
                 ORDER BY ID_TRS
                 OFFSET :startRecord ROWS 
                 FETCH NEXT :pageSize ROWS ONLY`,
                { fk_id_usr,startRecord, pageSize }
            );
    
            if (!transactionsQtty.rows || transactionsQtty.rows.length === 0) {
                console.log("Nenhum dado retornado ou estrutura inválida.");
                return [];
            }
    
            // Adiciona a quantidade de apostas a cada event
    
            console.log(transactionsQtty); // Para verificar o resultado final
            return transactionsQtty; // Retorna eventos com a quantidade de apostas
        } catch (err) {
            console.error("Erro ao buscar eventos:", err);
            throw err;
        } finally {
            if (connection) {
                await connection.close(); // Certifique-se de fechar a conexão
            }
        }
    }

    export const getSaldoHandler:RequestHandler = async (req:Request, res:Response) => {
        const pToken = req.get("Authorization");
        if (pToken){
            try {
                let saldo = await getSaldo(pToken);
                res.status(200).json({saldo});
            } catch (error) {
                res.statusCode = 500;
                res.send('Erro ao tentar localizar o saldo. Tente novamente');
            }
        } else {
            res.statusCode = 400;
            res.send('Parâmetros inválidos ou faltantes.');
        }
    }

    export const addFundsHandler:RequestHandler = async (req:Request, res:Response) => {
        const pToken = req.get('Authorization');
        const pValor = Number(req.get('valor'));
        const pCardNumber = Number(req.get('numero-cartao'));
        const pCvv = Number(req.get('cvv'));
        const pExpirationDate = req.get('validade');
        const pTipo = 'deposito';
        if (pToken && !isNaN(pValor) && !isNaN(pCardNumber) && !isNaN(pCvv) && pExpirationDate){
            if(pValor > 0 && validateCardNumber(pCardNumber,pCvv,pExpirationDate)){ 
                try {
                    var tipo = 1;
                    await addCreditCard(pToken,pCardNumber,pCvv,pExpirationDate);
                    await addFunds(pToken,pValor);
                    await addTransaction(pToken,pValor,pTipo);
                    res.statusCode = 200;
                    res.send('Créditos adicionados com sucesso.');
                } catch (error) {
                    res.statusCode = 500;
                    res.send('Erro ao tentar adicionar créditos na conta. Tente novamente.');
                }
            }else{
                res.statusCode = 400;
                res.send('Parâmetros inválidos ou faltantes.');
            }
        }else {
            res.statusCode = 400;
            res.send('Parâmetros inválidos ou faltantes.');
        }
    }

    export const withdrawFundsHandler:RequestHandler = async (req:Request, res:Response) => {
        const pToken = req.get('Authorization');
        const pValor = Number(req.get('valor'));
        const pTipo = 'saque';
        if (pToken && !isNaN(pValor)){
            if (pValor > 0){
                try {
                    const valorSacado = await withdrawFunds(pToken, pValor);
                    await addTransaction(pToken,pValor,pTipo);
                    res.status(200).json(valorSacado);
                } catch (error) {
                    res.statusCode = 500;
                    res.send('Erro ao tentar sacar o dinheiro. Tente novamente.');
                }
            } else {
                res.statusCode = 400;
                res.send('Parâmetros inválidos ou faltantes.')
            }
        } else {
            res.statusCode = 400;
            res.send('Parâmetros inválidos ou faltantes.');
        }
    }

    export const getTransactionsQttyHandler:RequestHandler = async (req:Request, res:Response) => {
        const pToken = req.get("Authorization");
        if(pToken){
            const transactionsQtty = await getTransactionsQtty(pToken);
            res.statusCode = 200;
            res.send(transactionsQtty.rows);
        }else {
            res.statusCode = 401;
            res.send('Não autorizado');
        }
        
    }

    export const getTransactionsByPageHandler: RequestHandler = async (req: Request, res: Response) => {
        try {
            const pToken = req.get("Authorization");
            const pPage = parseInt(req.get('page') || '', 10);
            const pPageSize = parseInt(req.get('pageSize') || '', 10);

            if (isNaN(pPage) || isNaN(pPageSize) || pPage < 1 || pPageSize < 1) {
                res.status(400).send('Parâmetros inválidos ou faltantes.');
            }

            if(pToken){
                const transactions = await getTransactionsByPage(pToken,pPage, pPageSize);
                console.log(transactions);
                res.status(200).json(transactions);
            }else{
                res.statusCode = 401;
                res.send('Não autorizado');
            }
            
        } catch (error) {
            console.error('Erro em getTransactionsByPageHandler:', error);
            res.status(500).send('Erro interno ao processar a solicitação.');
        }
    }
}
