import { Service } from 'typedi';
import RoleRepresentation from 'keycloak-admin/lib/defs/roleRepresentation';
import { config } from '../utils/config';
import { BaseRoleService } from './BaseRoleService';

@Service()
export class ClientRoleService extends BaseRoleService {
    protected async listRoles(clientId?: string) {
        return clientId
           ? await this.keycloakAdmin.api.clients.listRoles({ id: clientId, realm: config.get('keycloak.realm') })
           : []
        ;
    }

    protected async create(role: RoleRepresentation, clientId: string) {
        await this.keycloakAdmin.api.clients.createRole({
            ...role,
            id: clientId,
            realm: config.get('keycloak.realm'),
        });

        await this.addComposites(clientId, role);
    }

    protected async update(role: RoleRepresentation, clientId: string) {
        await this.keycloakAdmin.api.clients.updateRole(
            {
                id: clientId,
                roleName: (role as any).name,
                realm: config.get('keycloak.realm')
            },
            role
        );

        await this.addComposites(clientId, role);
    }
}
