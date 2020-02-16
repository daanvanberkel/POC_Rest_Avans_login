interface Name {
    formatted: string;
    familyName: string;
    givenName: string;
}

interface Accounts {
    username: string;
    userId: string;
}

export interface Profile {
    nickname: string;
    emails: string[];
    id: string;
    name: Name;
    tags: string[];
    accounts: Accounts;
    organizations: string;
    title: string;
    cardnumber: string;
    phoneNumbers: string[];
    location: string;
    employee: boolean;
    student: boolean;
    token: string;
    tokenSecret: string;
}
