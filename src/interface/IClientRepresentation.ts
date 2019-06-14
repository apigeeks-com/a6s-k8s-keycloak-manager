import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';

export interface IClientRepresentation extends ClientRepresentation {
    secretKeyRef?: {
        name: string;
        key: string;
    };
}
