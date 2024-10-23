import {Request, RequestHandler, Response} from "express";
import OracleDB, { autoCommit } from "oracledb";
import dotenv from "dotenv";
import bcrypt from 'bcryptjs';
dotenv.config();

export namespace AccountsManager {


    function validateEmail(email: string) :boolean{
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    function validatePassword(password: string) :boolean{
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&-])[A-Za-z\d@$!%*?&-]{8,}$/;
        const minlength = 8;
        if(password.length < minlength){
            return false;
        }
        return passwordRegex.test(password);
    }

    function validateBirthDate(birthDate: string): boolean{
        const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
        return dateRegex.test(birthDate);
    }

    async function signUp(nome:string, email:string, senha:string, dataNascimento:string) {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try {
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            let walletCreation = await connection.execute(
                `INSERT INTO WALLETS
                    (ID_CRT, SALDO)
                VALUES
                    (SEQ_WALLETSPK.NEXTVAL, 0)`,
                {},
                {autoCommit: false}
            );


            let insertion = await connection.execute(
                `INSERT INTO ACCOUNTS
                    (ID_USR,NOME,EMAIL,SENHA,DATA_NASC,TOKEN,FK_ID_CRT)
                VALUES
                    (SEQ_ACCOUNTSPK.NEXTVAL,:nome,:email,:senha,TO_DATE(:dataNascimento, 'DD-MM-YYYY'),dbms_random.string('x',32),SEQ_WALLETSFK.NEXTVAL)`,
                {nome,email,senha,dataNascimento},
                {autoCommit: false}
            );

            await connection.commit();
            console.log("Insertion results: ", insertion);

        } catch (err) {
            console.error("Database error: ", err);
            throw new Error("Error during account creation");

        } finally {
            if (connection){
                try{
                    await connection.close();
                } catch (err) {
                    console.error("Error closing the connection: ", err);
                }
            }
        }

    }

    export const signUpHandler: RequestHandler = async (req: Request, res: Response) =>{
        const pNome = req.get('nome');
        const pEmail = req.get('email');
        const pSenha = req.get('senha');
        const pBirthDate = req.get('dataNascimento');

        if (pEmail && pSenha && pNome && pBirthDate){
            if(validateEmail(pEmail) && validatePassword(pSenha) && validateBirthDate(pBirthDate)){
                try {
                    const hashedPassword = await bcrypt.hash(pSenha,10);
                    await signUp(pNome, pEmail, hashedPassword, pBirthDate);
                    res.statusCode = 200;
                    res.send('Conta criada com sucesso!');
                } catch (error) {
                    res.statusCode = 500;
                    res.send('Erro ao criar conta. Tente novamente.')
                }
            } else {
                res.statusCode = 400;
                res.send('Requisição inválida - Parâmetros incorretos.')
            }
        } else {
            res.statusCode = 400;
            res.send('Requisição inválida - Parâmetros faltando.');
        }
    }

}

//Verificar data e conectar com o banco.
//Criar um Wallet no Oracle