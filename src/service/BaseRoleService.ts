import * as prettyjson from 'prettyjson';
import { Logger } from 'log4js';
import { Inject } from 'typedi';
import RoleRepresentation, { RoleMappingPayload } from 'keycloak-admin/lib/defs/roleRepresentation';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import { InjectLogger } from '../decorator';
import { config } from '../utils/config';
import { RolesService } from './RolesService';
import { ProcessException } from '../exception';
import { KeycloakClient } from '../KeycloakClient';

export abstract class BaseRoleService {
    @Inject()
    protected rolesService!: RolesService;

    @InjectLogger('services/RoleService')
    protected logger!: Logger;

    async updateOrCreate(keycloakClient: KeycloakClient, roles?: RoleRepresentation[], client?: ClientRepresentation) {
        const existingRoles = await this.listRoles(keycloakClient, client && client.id);
        this.logger.debug(`Update or install roles`);
        this.logger.debug(`Exist roles: \n${prettyjson.render(existingRoles)}`);

        if (roles && Array.isArray(roles)) {
            await Promise.all(
                roles.map(async role => {
                    this.logger.debug(`Processed role: \n${prettyjson.render(role)}`);

                    const existingRole = existingRoles.find(r => r.name === role.name);

                    this.logger.debug(existingRole ? `update role: ${role.name}` : `create role: ${role.name}`);

                    existingRole && existingRole.id && existingRole.name
                        ? await this.update(keycloakClient, role, client && (client as any).id)
                        : await this.create(keycloakClient, role, client && (client as any).id);
                }),
            );
        }
    }

    protected async addComposites(keycloakClient: KeycloakClient, clientId: string, role: RoleRepresentation) {
        if (role.composites && role.composites.client) {
            this.logger.debug(`composites clients: \n${prettyjson.render(role.composites.client)}`);

            const clientRoles = await keycloakClient.clients.listRoles({
                id: clientId,
                realm: config.get('keycloak.realm'),
            });
            const roleFound = clientRoles.find(r => r.name === role.name);

            await Promise.all(
                Object.entries(role.composites.client).map(async ([clientName, roles]) => {
                    const clientList = await keycloakClient.clients.find({
                        clientId: clientName,
                        realm: config.get('keycloak.realm'),
                    });

                    if (!clientList.length) {
                        throw new ProcessException(`Client ${clientName} not found`);
                    }

                    const client: ClientRepresentation | any = clientList.pop();
                    const appendRoles = await this.rolesService.findClientRoles(keycloakClient, client, roles);

                    if (appendRoles) {
                        // TODO: It may be necessary to remove irrelevant roles.
                        await keycloakClient.clientRoleComposite.create({
                            id: (roleFound as any).id,
                            roles: <RoleMappingPayload[]>appendRoles,
                        });
                    }
                }),
            );
        }
    }

    protected abstract async listRoles(
        keycloakClient: KeycloakClient,
        clientId?: string,
    ): Promise<RoleRepresentation[]>;

    protected abstract async create(
        keycloakClient: KeycloakClient,
        role: RoleRepresentation,
        clientId: string,
    ): Promise<void>;

    protected abstract async update(
        keycloakClient: KeycloakClient,
        role: RoleRepresentation,
        clientId: string,
    ): Promise<void>;
}
