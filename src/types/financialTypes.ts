export type Wallet = {
    //idOwner: number;
    ownerEmail: string;
    balance: number;
    cardNumber: number | undefined;
};

export type CreditCard = {
    ownerName: string;
    cardNumber: number;
    cvvNumber: number;
    expirationDate: string;
};