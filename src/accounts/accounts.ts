import {Request, RequestHandler, Response} from "express";
import OracleDB from "oracledb";
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

    async function signUp(email:string, password:string, completeName:string, birthDate:string) {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try {
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            let insertion = await connection.execute(
                `INSERT INTO ACCOUNTS
                    (ID,EMAIL,PASSWORD,COMPLETE_NAME,BIRTHDATE,TOKEN)
                VALUES
                    (SEQ_ACCOUNTS.NEXTVAL,:email,:password,:completeName,TO_DATE(:birthDate, 'DD-MM-YYYY'),dbms_random.string('x',32))`,
                {email,password,completeName,birthDate},
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
        const pBirthDate = req.get('birthDate');

        if (pEmail && pPassword && pCompleteName && pBirthDate){
            if(validateEmail(pEmail) && validatePassword(pPassword) && validateBirthDate(pBirthDate)){
                try {
                    const hashedPassword = await bcrypt.hash(pPassword,10);
                    await signUp(pEmail, hashedPassword, pCompleteName, pBirthDate);
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