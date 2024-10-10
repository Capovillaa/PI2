export type UserAccount = {
    name:string;
    email:string;
    password:Promise<string>;
    birthdate:string; 
};