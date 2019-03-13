import Resource from 'keycloak-admin/lib/resources/resource';
import { KeycloakAdminClient } from 'keycloak-admin/lib/client';
import RoleRepresentation from 'keycloak-admin/lib/defs/roleRepresentation';
import { config } from '../utils/config';

export class ClientRoleComposite extends Resource {
    constructor(client: KeycloakAdminClient) {
        super(client, {
            path: '/admin/realms/{realm}/roles-by-id',
            getUrlParams: () => ({
                realm: config.get('keycloak.realm'),
            }),
            getBaseUrl: () => client.baseUrl,
        });
    }

    public create = this.makeRequest<{ id: string; roles: RoleRepresentation[] }, void>({
        method: 'POST',
        path: '/{id}/composites',
        urlParamKeys: ['id'],
        payloadKey: 'roles',
    });
}
