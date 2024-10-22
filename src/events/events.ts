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
