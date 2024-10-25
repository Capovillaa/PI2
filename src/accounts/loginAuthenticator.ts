import { Request, Response, RequestHandler } from "express";
import OracleDB from "oracledb";
import { AccountsManager } from "./accounts";
import bcrypt from 'bcryptjs';

interface Account {
    NOME: string;
    EMAIL: string;
    SENHA: string;
}
export const getLoginAuthenticatorHandler: RequestHandler = async (req: Request, res: Response) => {
    const AutEmail = req.get('email');
    const AutSenha = req.get('senha');

    if (AutEmail && AutSenha) {
        try {
            OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;

            const connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            let AutLogin = await connection.execute(
                'SELECT NOME, EMAIL, SENHA FROM ACCOUNTS WHERE EMAIL = :email',
                [AutEmail]
            );

            await connection.close();

            if (AutLogin.rows && AutLogin.rows.length > 0) {
                const account = AutLogin.rows[0] as unknown as Account;  
                const SenhaCriptografada = account.SENHA;

                const isPasswordValid = await bcrypt.compare(AutSenha, SenhaCriptografada); 

                if (isPasswordValid) {
                    res.status(200).send(`Login bem sucedido. Bem-vindo(a), ${account.NOME}!`);
                } else {
                    res.status(401).send("Senha incorreta.");
                }
            } else {
                res.status(401).send("Email incorreto.");
            }
        } catch (err) {
            console.error(err);
            res.status(500).send("Erro interno do servidor.");
        }
    } else {
        res.status(400).send("Email e senha são obrigatórios.");
    }
};

/*import { Request, Response, RequestHandler } from "express";
import OracleDB from "oracledb";
import { AccountsManager } from "./accounts";
import bcrypt from 'bcryptjs';

interface Account {
    NOME: string;
    EMAIL: string;
    SENHA: string;
}
interface AccountADMIN {
    EMAIL: string;
    SENHA: string;
}

export const getLoginAuthenticatorHandler: RequestHandler = async (req: Request, res: Response) => {
    const AutEmail = req.get('email');
    const AutSenha = req.get('senha');

    if (AutEmail && AutSenha) {
        try {
            OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;

            const connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            // Primeiro, verifica na tabela admin_account
            let AutLoginAdmin = await connection.execute(
                'SELECT EMAIL, SENHA FROM ADMIN_ACCOUNTS WHERE EMAIL = :email',
                [AutEmail]
            );

            // Verifica se o login foi bem-sucedido na tabela admin_account
            if (AutLoginAdmin.rows && AutLoginAdmin.rows.length > 0) {
                const account = AutLoginAdmin.rows[0] as unknown as AccountADMIN;
                const SenhaCriptografada = account.SENHA;

                const isPasswordValid = await bcrypt.compare(AutSenha, SenhaCriptografada);

                if (isPasswordValid) {
                    res.status(200).send(`Login bem sucedido. Bem-vindo(a), Admin!`); // Mensagem para Admin
                    return; // Termina a função após resposta de admin
                } else {
                    res.status(401).send("Senha incorreta.");
                    return; // Termina a função após verificar a senha
                }
            }

            // Se não encontrou na tabela admin_account, verifica na tabela accounts
            let AutLoginUser = await connection.execute(
                'SELECT NOME, EMAIL, SENHA FROM ACCOUNTS WHERE EMAIL = :email',
                [AutEmail]
            );

            await connection.close();

            if (AutLoginUser.rows && AutLoginUser.rows.length > 0) {
                const account = AutLoginUser.rows[0] as unknown as Account;  
                const SenhaCriptografada = account.SENHA;

                const isPasswordValid = await bcrypt.compare(AutSenha, SenhaCriptografada); 

                if (isPasswordValid) {
                    res.status(200).send(`Login bem sucedido. Bem-vindo(a), ${account.NOME}!`); // Mensagem para usuário comum
                } else {
                    res.status(401).send("Senha incorreta.");
                }
            } else {
                res.status(401).send("Email incorreto.");
            }
        } catch (err) {
            console.error(err);
            res.status(500).send("Erro interno do servidor.");
        }
    } else {
        res.status(400).send("Email e senha são obrigatórios.");
    }
};
*/