export interface IKeycloakScope {
    name: string;
    description?: string;
    protocol?: string;
    attributes: { [key: string]: string };
    protocolMappers: { [key: string]: any }[];
    realmRoles?: string[];
}
