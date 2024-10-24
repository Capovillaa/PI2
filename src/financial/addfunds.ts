import {Request,Response,RequestHandler} from "express";
import OracleDB from "oracledb";
import bcrypt from 'bcryptjs';
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
                console.log("Resultados da inserção: ", insertion);
            }
        }catch (err) {
            console.error("Erro do banco de dados: ", err);
            throw new Error("Erro ao registrar o cartão de crédito.");
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
            
            let update = await connection.execute(
                `UPDATE WALLETS
                 SET SALDO = :balance
                 WHERE ID_CRT = :idCrt`,
                {balance, idCrt},
                {autoCommit: false}
            );

            await connection.commit();
            console.log("Resultados da adição: ", update);
     
        }catch (err) {
            console.error("Erro do banco de dados: ", err);
            throw new Error("Erro ao tentar adicionar fundos à carteira.");
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

    async function withdrawFunds(email: string, senha: string, contaBancaria: string, valor: number) {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try{
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            interface Account {
                EMAIL: string;
                SENHA: string;
                FK_ID_CRT: number;
            }

            interface balanceResult {
                SALDO: number;
            }

            let Authentication = await connection.execute(
                'SELECT EMAIL, SENHA, FK_ID_CRT FROM ACCOUNTS WHERE EMAIL = :email',
                {email}
            );

            if (Authentication.rows && Authentication.rows.length > 0){
                const account = Authentication.rows[0] as unknown as Account;  
                const SenhaCriptografada = account.SENHA;

                const isPasswordValid = await bcrypt.compare(senha, SenhaCriptografada);

                if (isPasswordValid){
                    let idCrt = account.FK_ID_CRT;

                    let resultBalance = await connection.execute<balanceResult>(
                        `SELECT SALDO
                         FROM WALLETS
                         WHERE ID_CRT = :idCrt`,
                         {idCrt}
                    )

                    let balance = resultBalance.rows?.[0]?.SALDO;
                    if (balance === undefined || balance === null) {
                        throw new Error("Carteira do usuário não encontrada.");
                    }

                    if (valor > balance){
                        throw new Error("Saldo em conta é menor que o valor que deseja sacar.");
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
                    console.log("Resultados do saque: ", update);

                }
            } else {
                throw new Error("Email não encontrado.");
            }

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

    export const withdrawFundsHandler:RequestHandler = async (req:Request, res:Response) => {
        const pEmail = req.get('email');
        const pSenha = req.get('senha');
        const pContaBancaria = req.get('contaBancaria');
        const pValor = Number(req.get('valor'));
        if (pEmail && pSenha && pContaBancaria && !isNaN(pValor)){
            try {
                await withdrawFunds(pEmail, pSenha, pContaBancaria, pValor);
                res.statusCode = 200;
                res.send('Valor sacado com sucesso!');
            } catch (error) {
                res.statusCode = 500;
                res.send('Erro ao sacar o dinheiro. Tente novamente.');
            }
        } else {
            res.statusCode = 400;
            res.send('Parametros invalidos ou faltantes.');
        }
    }
}