import { Service } from 'typedi';
import RoleRepresentation from 'keycloak-admin/lib/defs/roleRepresentation';
import { config } from '../utils/config';
import { BaseRoleService } from './BaseRoleService';
import { KeycloakClient } from '../KeycloakClient';

@Service()
export class ClientRoleService extends BaseRoleService {
    protected async listRoles(keycloakClient: KeycloakClient, clientId?: string) {
        return clientId
            ? await keycloakClient.clients.listRoles({ id: clientId, realm: config.get('keycloak.realm') })
            : [];
    }

    protected async create(keycloakClient: KeycloakClient, role: RoleRepresentation, clientId: string) {
        await keycloakClient.clients.createRole({
            ...role,
            id: clientId,
            realm: config.get('keycloak.realm'),
        });

        await this.addComposites(keycloakClient, clientId, role);
    }

    protected async update(keycloakClient: KeycloakClient, role: RoleRepresentation, clientId: string) {
        await keycloakClient.clients.updateRole(
            {
                id: clientId,
                roleName: (role as any).name,
                realm: config.get('keycloak.realm'),
            },
            role,
        );

        await this.addComposites(keycloakClient, clientId, role);
    }
}
