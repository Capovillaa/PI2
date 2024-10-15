import {Request, RequestHandler, Response} from "express";
import { UserAccount } from "../types/accountsTypes";
import bcrypt from 'bcryptjs';

export namespace AccountsManager {

    let accountsDatabase: UserAccount[] = [];

    function saveNewAccount(ua: UserAccount) : number{
        accountsDatabase.push(ua);
        return accountsDatabase.length;
    }

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

    export const signUpRouteHandler: RequestHandler = async (req: Request, res: Response) => {
        
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

}

//Verificar data e conectar com o banco.
//Criar um Wallet no Oracle