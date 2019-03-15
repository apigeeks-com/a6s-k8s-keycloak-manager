import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import RoleRepresentation from 'keycloak-admin/lib/defs/roleRepresentation';
import GroupRepresentation from 'keycloak-admin/lib/defs/groupRepresentation';
import { IKeycloakUser } from './IKeycloakUser';
import { IKeycloakScope } from './IKeycloakScope';

export interface IKeycloakClientResourceSpec extends ClientRepresentation {
    associatedUsers?: IKeycloakUser[];
    associatedGroups?: GroupRepresentation[];
    realmRoles?: RoleRepresentation[];
    clientRoles?: RoleRepresentation[];
    clientScopes?: IKeycloakScope[];
    scopeRealmMappers?: string[];
    realmRoleMappers?: string[];
    clientRoleMappers?: string[];
    clientId: string;
}
