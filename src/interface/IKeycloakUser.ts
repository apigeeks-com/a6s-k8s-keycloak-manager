import UserRepresentation from 'keycloak-admin/lib/defs/userRepresentation';

export interface IKeycloakUser extends UserRepresentation {
    id: string;
    email: string;
    password: string;
}
