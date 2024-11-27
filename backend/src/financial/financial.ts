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
        if (pToken && !isNaN(pValor) && !isNaN(pCardNumber) && !isNaN(pCvv) && pExpirationDate){
            if(pValor > 0 && validateCardNumber(pCardNumber,pCvv,pExpirationDate)){ 
                try {
                    await addCreditCard(pToken,pCardNumber,pCvv,pExpirationDate);
                    await addFunds(pToken,pValor);
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
        if (pToken && !isNaN(pValor)){
            if (pValor > 0){
                try {
                    const valorSacado = await withdrawFunds(pToken, pValor);
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
}
