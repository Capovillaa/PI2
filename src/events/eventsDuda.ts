import { Request, Response, RequestHandler } from "express";
import OracleDB from "oracledb";
import dotenv from "dotenv";
dotenv.config();

export namespace EventsManager {

    interface GetEvent {
        ID_EVENTO: number;
        TITULO: string;
        DESCRICAO: string;
        DATA_INICIO: Date;
        DATA_FIM: Date;
        DATA_EVENTO: Date;
    }

    async function getEventos(searchTerm: string | undefined): Promise<GetEvent[]> {
        OracleDB.outFormat = OracleDB.OUT_FORMAT_OBJECT;
        let connection;

        try {
            connection = await OracleDB.getConnection({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONN_STR
            });

            let sqlgetEvents = `SELECT ID_EVT, TITULO, DESCRICAO, DATA_INICIO, DATA_FIM, DATA_EVT FROM APPROVED_EVENTS`;
            let paramsgetEvents: any = {};
            let conditionsgetEvents: string[] = [];
            
            if (searchTerm) {
                conditionsgetEvents.push(`(TITULO LIKE :termo OR DESCRICAO LIKE :termo)`);
                paramsgetEvents.termo = `%${searchTerm}%`; 
            }
            //preciso arrumar para letras maiusculas e minusculas
            
            if (conditionsgetEvents.length > 0) {
                sqlgetEvents += ' WHERE ' + conditionsgetEvents.join(' AND ');
            }
            
            const resultGetEvents = await connection.execute(sqlgetEvents, paramsgetEvents);
            await connection.close();

            if (resultGetEvents.rows && resultGetEvents.rows.length > 0) {
                return resultGetEvents.rows as GetEvent[];
            } else {
                console.log ('Nenhum evento encontrado com essa palavra.');
                return [];
            }
        } catch (err) {
            console.error("Database error: ", err);
            throw new Error("Error during event retrieval");
        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (err) {
                    console.error("Error closing the connection: ", err);
                }
            }
        }
    }
    export const getEventosHandler: RequestHandler = async (req: Request, res: Response) => {
        const searchTerm = req.query.palavra as string | undefined;
    
        try {
            console.log("Parâmetro de busca: ", searchTerm);
            const eventos = await getEventos(searchTerm); 
            if (eventos.length > 0) {
                res.status(200).json(eventos); 
            } else {
                res.status(404).send("Nenhum evento encontrado."); 
            }
        } catch (error) {
            console.error("Erro ao buscar eventos: ", error); 
            res.status(500).send("Erro interno do servidor."); 
        }
    };
            
}

