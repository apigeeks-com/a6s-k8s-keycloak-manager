import * as prettyjson from 'prettyjson';
import { Logger } from 'log4js';
import { Inject } from 'typedi';
import RoleRepresentation, { RoleMappingPayload } from 'keycloak-admin/lib/defs/roleRepresentation';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import { KeycloakAdminService } from './KeycloakAdminService';
import { InjectLogger } from '../decorator';
import { config } from '../utils/config';
import { RolesService } from './RolesService';
import { ProcessException } from '../exception';

export abstract class BaseRoleService {
    @Inject()
    protected keycloakAdmin!: KeycloakAdminService;

    @Inject()
    protected rolesService!: RolesService;

    @InjectLogger('services/RoleService')
    protected logger!: Logger;

    async updateOrCreate(roles?: RoleRepresentation[], client?: ClientRepresentation) {
        await this.keycloakAdmin.auth();
        const existingRoles = await this.listRoles(client && client.id);
        this.logger.debug(`Update or install roles`);
        this.logger.debug(`Exist roles: \n${prettyjson.render(existingRoles)}`);

        if (roles && Array.isArray(roles)) {
            await Promise.all(
                roles.map(async role => {
                    this.logger.debug(`Processed role: \n${prettyjson.render(role)}`);

                    const existingRole = existingRoles.find(r => r.name === role.name);

                    this.logger.debug(existingRole ? `update role: ${role.name}` : `create role: ${role.name}`);

                    existingRole && existingRole.id && existingRole.name
                        ? await this.update(role, client && (client as any).id)
                        : await this.create(role, client && (client as any).id)
                    ;
                }),
            );
        }
    }

    protected async addComposites(clientId: string, role: RoleRepresentation) {
        if (role.composites && role.composites.client) {
            this.logger.debug(`composites clients: \n${prettyjson.render(role.composites.client)}`);

            const clientRoles = await this.keycloakAdmin.api.clients.listRoles({
                id: clientId,
                realm: config.get('keycloak.realm'),
            });
            const roleFound = clientRoles.find(r => r.name === role.name);

            await Promise.all(
                Object.entries(role.composites.client).map(async ([clientName, roles]) => {
                    const clientList = await this.keycloakAdmin.api.clients.find({
                        clientId: clientName,
                        realm: config.get('keycloak.realm'),
                    });

                    if (!clientList.length) {
                        throw new ProcessException(`Client ${clientName} not found`);
                    }

                    const client: ClientRepresentation | any = clientList.pop();
                    const appendRoles = await this.rolesService.findClientRoles(client, roles);

                    if (appendRoles) {
                        // TODO: It may be necessary to remove irrelevant roles.
                        await this.keycloakAdmin.api.clientRoleComposite.create({
                            id: (roleFound as any).id,
                            roles: <RoleMappingPayload[]>appendRoles,
                        });
                    }
                }),
            );
        }
    }

    protected abstract async listRoles(clientId?: string): Promise<RoleRepresentation[]>;

    protected abstract async create(role: RoleRepresentation, clientId: string): Promise<void>;

    protected abstract async update(role: RoleRepresentation, clientId: string): Promise<void>;
}
