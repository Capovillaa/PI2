import {Request,Response,RequestHandler} from "express";
import OracleDB from "oracledb";
import bcrypt from 'bcryptjs';
import dotenv from "dotenv";
dotenv.config();

export namespace FinancialManager{

    function validateEmail(email: string) :boolean{
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function validateCardNumber(cardNumber:number,cvv:number,expirationDate:string) :boolean{
        const expirationDateRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;     
        if(cardNumber > 9999999999999 && cardNumber < 10000000000000000 && cvv > 99 && cvv < 1000 && expirationDateRegex.test(expirationDate)){
            return true;
        }
        return false;
    }

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
                throw new Error("Não existe nenhum usuário com este email.");
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
                throw new Error("Não existe nenhum usuário com este email.");
            };

            let resultBalance = await connection.execute<balanceResult>(
                `SELECT SALDO
                 FROM WALLETS
                 WHERE ID_CRT = :idCrt`,
                {idCrt}
            );

            let balance = resultBalance.rows?.[0]?.SALDO;
            if (balance === undefined || balance === null) {
                throw new Error("Carteira do usuário não foi encontrada.");
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
            console.log("Resultados da atualização: ", update);
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

    async function withdrawFunds(email: string, senha: string, contaBancaria: number, valor: number): Promise<number> {
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

            let valorTaxado: number = 0;

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
                        throw new Error("Não existe nenhum usuário com este email.");
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
                }
            } else {
                throw new Error("Não existe nenhum usuário com este email.");
            }

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

    export const addFundsHandler:RequestHandler = async (req:Request, res:Response) => {
        const pEmail = req.get('email');
        const pValor = Number(req.get('valor'));
        const pCardNumber = Number(req.get('numero-cartao'));
        const pCvv = Number(req.get('cvv'));
        const pExpirationDate = req.get('validade');
        if (pEmail && !isNaN(pValor) && !isNaN(pCardNumber) && !isNaN(pCvv) && pExpirationDate){
            if(validateEmail(pEmail) && pValor > 0 && validateCardNumber(pCardNumber,pCvv,pExpirationDate)){ 
                try {
                    await addCreditCard(pEmail,pCardNumber,pCvv,pExpirationDate);
                    await addFunds(pEmail,pValor);
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
        const pEmail = req.get('email');
        const pSenha = req.get('senha');
        const pContaBancaria = Number(req.get('contaBancaria'));
        const pValor = Number(req.get('valor'));
        if (pEmail && pSenha && !isNaN(pContaBancaria) && !isNaN(pValor)){
            if (validateEmail(pEmail) && pValor > 0){
                try {
                    const valorSacado = await withdrawFunds(pEmail, pSenha, pContaBancaria, pValor);
                    res.statusCode = 200;
                    res.send(`Valor depositado na conta ${pContaBancaria} após a taxação: ${valorSacado}.`);
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