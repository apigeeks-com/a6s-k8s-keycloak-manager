import Resource from 'keycloak-admin/lib/resources/resource';
import { KeycloakAdminClient } from 'keycloak-admin/lib/client';
import RoleRepresentation from 'keycloak-admin/lib/defs/roleRepresentation';
import { config } from '../utils/config';

export class ClientScopeMappings extends Resource {
    constructor(client: KeycloakAdminClient) {
        super(client, {
            path: '/admin/realms/{realm}/clients',
            getUrlParams: () => ({
                realm: config.get('keycloak.realm'),
            }),
            getBaseUrl: () => client.baseUrl,
        });
    }

    public realmRoleClientMappings = this.makeRequest<{ clientId: string; roles: RoleRepresentation[] }, void>({
        method: 'POST',
        path: '/{clientId}/scope-mappings/realm',
        urlParamKeys: ['clientId'],
        payloadKey: 'roles',
    });
}
