import {Request, RequestHandler, Response} from "express";
import OracleDB from "oracledb";
import dotenv from "dotenv";
import { UserAccount } from "../types/accountsTypes";
import bcrypt from 'bcryptjs';
dotenv.config();

export namespace AccountsManager {


    function verifyEmail(email: string) :boolean{
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    function verifyPassword(password: string) :boolean{
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        const minlength = 8;
        if(password.length < minlength){
            return false;
        }
        return passwordRegex.test(password);
    }

    /*
    let accountsDatabase: UserAccount[] = [];

    function saveNewAccount(ua: UserAccount) : number{
        accountsDatabase.push(ua);
        return accountsDatabase.length;
    }

    export const signUpHandlerr: RequestHandler = async (req: Request, res: Response) => {
        
        const pName = req.get('name');
        const pEmail = req.get('email');
        const pPassword = req.get('password');
        const pBirthdate = req.get('birthdate');//verificar data dps 
        
        if(pName && pEmail && pPassword && pBirthdate){
            if(verifyEmail(pEmail) && verifyPassword(pPassword)){

                const hashedPassword = await bcrypt.hash(pPassword,10);
                const newAccount: UserAccount = {
                    completeName: pName,
                    email: pEmail, 
                    password: hashedPassword,
                    birthdate: pBirthdate
                }
                const ID = saveNewAccount(newAccount);
                res.statusCode = 200; 
                res.send(`Nova conta adicionada. Código: ${ID}`);
            }else{
                res.statusCode = 400;
                res.send("Parâmetros inválidos ou faltantes");
            }
        }else{
            res.statusCode = 400;
            res.send("Parâmetros inválidos ou faltantes.");
        }
    }
    */

    async function signUp(email:string, password:string, completeName:string) {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try {
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            let insertion = await connection.execute(
                "INSERT INTO ACCOUNTS(ID,EMAIL,PASSWORD,COMPLETE_NAME,TOKEN)VALUES(SEQ_ACCOUNTS.NEXTVAL,:email,:password,:completeName,dbms_random.string('x',32))",
                {email,password,completeName},
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
        const pEmail = req.get('email');
        const pPassword = req.get('password');
        const pCompleteName = req.get('completeName');

        if (pEmail && pPassword && pCompleteName){
            if(verifyEmail(pEmail) && verifyPassword(pPassword)){
                try {
                    const hashedPassword = await bcrypt.hash(pPassword,10);
                    await signUp(pEmail, hashedPassword, pCompleteName);
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