import {Request,Response,RequestHandler} from "express";
import { Wallet } from "../types/financialTypes";

export namespace FinancialManager{

    let walletDatabase: Wallet[] = [];

    let w1: Wallet = {
        ownerEmail : "pedro@puc.edu.br",
        balance: 0,
        cardNumber: undefined
    };
    
    walletDatabase.push(w1);

    function addFunds(email: string, valor: number){
        const wallet = walletDatabase.find(w => w.ownerEmail === email);
        if (wallet?.balance){
            wallet.balance = wallet.balance + valor;
        }
    }

    export const addFundsHandler:RequestHandler = async (req:Request, res:Response) => {

        const pEmail = req.get('email');
        const pValor = Number(req.get('valor'));
        const pCardNumber = Number(req.get('numero-cartao'));

        if (pEmail && pValor && pCardNumber){
            addFunds(pEmail, pValor);
            res.statusCode = 200;
            res.send(`Foram adicionados a conta ${pValor} reais.`);
        } else {
            res.statusCode = 400;
            res.send('Parametros invalidos ou faltantes.')
        }

    }
            
    
}