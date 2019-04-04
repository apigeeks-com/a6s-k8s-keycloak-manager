import { Service } from 'typedi';
import RoleRepresentation from 'keycloak-admin/lib/defs/roleRepresentation';
import { config } from '../utils/config';
import { BaseRoleService } from './BaseRoleService';
import { KeycloakClient } from '../KeycloakClient';

@Service()
export class RealmRoleService extends BaseRoleService {
    protected async listRoles(keycloakClient: KeycloakClient) {
        return await keycloakClient.roles.find({ realm: config.get('keycloak.realm') } as any);
    }

    protected async create(keycloakClient: KeycloakClient, role: RoleRepresentation, clientId: string) {
        await keycloakClient.roles.create({
            ...role,
            realm: config.get('keycloak.realm'),
        });

        await this.addComposites(keycloakClient, clientId, role);
    }

    protected async update(keycloakClient: KeycloakClient, role: RoleRepresentation, clientId: string) {
        await keycloakClient.roles.updateByName(
            {
                name: (role as any).name,
                realm: config.get('keycloak.realm'),
            },
            role,
        );

        await this.addComposites(keycloakClient, clientId, role);
    }
}
