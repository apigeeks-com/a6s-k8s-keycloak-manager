import { Service } from 'typedi';
import RoleRepresentation from 'keycloak-admin/lib/defs/roleRepresentation';
import { config } from '../utils/config';
import { BaseRoleService } from './BaseRoleService';

@Service()
export class RealmRoleService extends BaseRoleService {
    protected async listRoles() {
        return await this.keycloakAdmin.api.roles.find({ realm: config.get('keycloak.realm') } as any);
    }

    protected async create(role: RoleRepresentation, clientId: string) {
        await this.keycloakAdmin.api.roles.create({
            ...role,
            realm: config.get('keycloak.realm'),
        });

        await this.addComposites(clientId, role);
    }

    protected async update(role: RoleRepresentation, clientId: string) {
        await this.keycloakAdmin.api.roles.updateByName(
            {
                name: (role as any).name,
                realm: config.get('keycloak.realm'),
            },
            role,
        );

        await this.addComposites(clientId, role);
    }
}
