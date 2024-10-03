import {Request,Response,RequestHandler} from "express";

export namespace FinancialManager{

    export type Wallet = {
        ownerEmail: string;
        balance: number;
    }

    let walletDatabase: Wallet[] = [];
    const w1: Wallet = {
        ownerEmail : "pedro@puca.edu.br",
        balance: 0
    };
    const w2: Wallet={
        ownerEmail:"Joao@puc.edu.br",
        balance: 10000
    };
    
    walletDatabase.push(w1);
    walletDatabase.push(w2);

    function getWalletBalance(email:string):number | undefined{
        return walletDatabase.find(w => {
            if(w.ownerEmail === email){
                return;
            }
        })?.balance;
    }

    export const getWalletBalanceHandler: RequestHandler = 
            (req:Request,res:Response) => {
                //ser feliz nessa semana e implementar isso.
            }


    
}