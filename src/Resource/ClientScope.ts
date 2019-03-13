import Resource from 'keycloak-admin/lib/resources/resource';
import { KeycloakAdminClient } from 'keycloak-admin/lib/client';
import { IKeycloakScope } from '../interface';
import RoleRepresentation from 'keycloak-admin/lib/defs/roleRepresentation';
import { config } from '../utils/config';

export class ClientScope extends Resource {
    constructor(client: KeycloakAdminClient) {
        super(client, {
            path: '/admin/realms/{realm}/client-scopes',
            getUrlParams: () => ({
                realm: config.get('keycloak.realm'),
            }),
            getBaseUrl: () => client.baseUrl,
        });
    }

    public find = this.makeRequest<void, IKeycloakScope[]>({
        method: 'GET',
    });

    public create = this.makeRequest<IKeycloakScope, void>({
        method: 'POST',
    });

    public update = this.makeUpdateRequest<{ id: string }, IKeycloakScope, void>({
        method: 'PUT',
        path: '/{id}',
        urlParamKeys: ['id'],
    });

    public realmRoleMappings = this.makeRequest<{ id: string; roles: RoleRepresentation[] }, void>({
        method: 'POST',
        path: '/{id}/scope-mappings/realm',
        urlParamKeys: ['id'],
        payloadKey: 'roles',
    });
}
