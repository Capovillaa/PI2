import { Request, RequestHandler, Response } from "express";
import OracleDB from "oracledb";
import dotenv from 'dotenv'; 
dotenv.config();

export type Event = {
    id_evento: number | undefined; 
    id_usuario: number;            
    titulo: string;                 
    descricao: string;              
    valor_cota: number;             
    data_hora_inicio: string;        
    data_hora_fim: string;          
    data_evento: string;              
    status_evento: string;          
};

async function userId(token: string): Promise<number | null> {
    OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;

    const connection = await OracleDB.getConnection({
        user: process.env.ORACLE_USER,
        password: process.env.ORACLE_PASSWORD,
        connectString: process.env.ORACLE_CONN_STR
    });

    try {
        const result = await connection.execute(
            `SELECT ID FROM ACCOUNTS WHERE TOKEN = :token`,
            [token]
        );

        const rows = result.rows as Account[];

        if (rows && rows.length > 0) {
            return rows[0].ID; 
        } else {
            return null; 
        }
    } catch (error) {
        console.error('Erro:', error);
        return null; 
    } finally {
        await connection.close(); 
    }
}

async function addNewEvent(
    id_usuario: number, 
    titulo: string, 
    descricao: string, 
    valor_cota: number, 
    data_hora_inicio: string, 
    data_hora_fim: string, 
    data_evento: string
) {
    OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;

    const connection = await OracleDB.getConnection({
        user: process.env.ORACLE_USER,
        password: process.env.ORACLE_PASSWORD,
        connectString: process.env.ORACLE_CONN_STR
    });

    await connection.execute(
        `INSERT INTO EVENTS (ID_PAP, ID_USR, TITULO, DESCRICAO, VALOR_COTA, DATA_INICIO, DATA_FIM, DATA_EVT) 
         VALUES (SEQ_EVENTS.NEXTVAL, :id_usr, :titulo, :descricao, :valor_cota, 
         TO_DATE(:data_inicio, 'yyyy/mm/dd hh24:mi:ss'), 
         TO_DATE(:data_fim, 'yyyy/mm/dd hh24:mi:ss'), 
         TO_DATE(:data_evt, 'YYYY-MM-DD'))`,
        [id_usuario, titulo, descricao, valor_cota, data_hora_inicio, data_hora_fim, data_evento]
    );

    await connection.commit();
    await connection.close();
}

async function evaluateNewEvent(id_evento: number, status: string) {
    OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;

    const connection = await OracleDB.getConnection({
        user: process.env.ORACLE_USER,
        password: process.env.ORACLE_PASSWORD,
        connectString: process.env.ORACLE_CONN_STR
    });

    await connection.execute(
        `UPDATE EVENTS SET STATUS_EVENTO = :status WHERE ID_EVENTO = :id_evt`,
        [status, id_evento],
    );

    await connection.commit();
    await connection.close();
}

async function getAvailableEvents() {
    OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;

    const connection = await OracleDB.getConnection({
        user: process.env.ORACLE_USER,
        password: process.env.ORACLE_PASSWORD,
        connectString: process.env.ORACLE_CONN_STR
    });

    let events = await connection.execute(
        `SELECT 
            id_evt, 
            id_usr, 
            titulo, 
            descricao, 
            valor_cota, 
            TO_CHAR(data_inicio, 'YYYY-MM-DD HH24:MI:SS') AS data_inicio, 
            TO_CHAR(data_fim, 'YYYY-MM-DD HH24:MI:SS') AS data_fim, 
            TO_CHAR(data_evt, 'YYYY-MM-DD') AS data_evt, 
            status_evento 
        FROM 
            EVENTS 
        WHERE 
            status_evento = 'APROVADO' 
            AND data_hora_fim > SYSDATE`
    );

    await connection.close();
    return events.rows;
}

export namespace EventsManager{

    async function addNewEvent(email: string, titulo: string, descricao: string, 
    valorCota: number, dataHoraInicio: string, dataHoraFim: string, dataEvento: string) {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try {
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectionString: process.env.ORACLE_CONN_STR
            });

            interface AccountResult {
                ID_USR: number;
            }

            let resultIdUsr = await connection.execute<AccountResult>(
                `SELECT ID_USR
                 FROM ACCOUNTS
                 WHERE EMAIL = :email`,
                {email}
            );

            let idUsr = resultIdUsr.rows?.[0]?.ID_USR;
            if (!idUsr) {
                throw new Error("Usuário com este email não encontrado.");
            }

            let insertion = await connection.execute(
                `INSERT INTO EVENTS
                 (ID_EVT, FK_ID_USR, TITULO, DESCRICAO, DATA_INICIO, DATA_FIM, DATA_EVT, VALOR_COTA)
                 VALUES
                 (SEQ_EVENTSPK.NEXTVAL, :idUsr, :titulo, :descricao, 
                 TO_DATE(:dataHoraInicio, 'yyyy/mm/dd hh24:mi:ss'), 
                 TO_DATE(:dataHoraFim, 'yyyy/mm/dd hh24:mi:ss'), 
                 TO_DATE(:dataEvento, 'YYYY-MM-DD'), 
                 :valorCota)`,
                 {idUsr, titulo, descricao, dataHoraInicio, dataHoraFim, dataEvento, valorCota},
                 {autoCommit: false}
            );
            await connection.commit();
            console.log("Resultados da inserção: ", insertion);

        }catch (err) {
            console.error("Erro do banco de dados: ", err);
            throw new Error("Erro ao registrar o evento.");
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

    export const addNewEventsHandler:RequestHandler = async (req: Request, res:Response) => {
        const pEmail = req.get('email');
        const pTitulo = req.get('titulo');
        const pDescricao = req.get('descricao');
        const pValorCota = Number(req.get('valor-cota'));
        const pDataHoraInicio = req.get('data-hora-inicio'); //Verificar se está correto
        const pDataHoraFim = req.get('data-hora-fim');
        const pDataEvento = req.get('data-evento');

        if (pEmail && pTitulo && pDescricao && !isNaN(pValorCota) && pDataHoraInicio && pDataHoraFim && pDataEvento){
            try {
                await addNewEvent(pEmail, pTitulo, pDescricao, pValorCota, pDataHoraInicio, pDataHoraFim, pDataEvento);
                res.statusCode = 200;
                res.send('Evento criado com sucesso.');
            } catch (error) {
                res.statusCode = 500;
                res.send('Erro ao criar o evento. Tente novamente.');
            }
        } else {
            res.statusCode = 400;
            res.send('Parâmetros inválidos ou faltantes.');
        }
    }
}