import * as prettyjson from 'prettyjson';
import { Logger } from 'log4js';
import { Inject, Service } from 'typedi';
import RoleRepresentation, { RoleMappingPayload } from 'keycloak-admin/lib/defs/roleRepresentation';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import { KeycloakAdminService } from './KeycloakAdminService';
import { InjectLogger } from '../decorator';
import { config } from '../utils/config';
import { RolesService } from './RolesService';
import { ProcessException } from '../exception';

@Service()
export class ClientRoleService {
    @Inject()
    private keycloakAdmin!: KeycloakAdminService;

    @Inject()
    private rolesService!: RolesService;

    @InjectLogger('services/ClientRoleService')
    private logger!: Logger;

    async updateOrCreate(roles: RoleRepresentation[] | undefined, client: ClientRepresentation) {
        await this.keycloakAdmin.auth();
        const existingRoles = client.id
          ? await this.keycloakAdmin.api.clients.listRoles({ id: client.id, realm: config.get('keycloak.realm') })
          : []
        ;
        this.logger.info(`Update or install roles`);
        this.logger.debug(`Exist roles: \n${prettyjson.render(existingRoles)}`);

        if (!client.id) {
            throw new Error('Client id property cannot be undefined');
        }

        if (roles && Array.isArray(roles)) {
            await Promise.all(
                roles.map(async role => {
                    this.logger.debug(`Processed role: \n${prettyjson.render(role)}`);

                    const existingRole = existingRoles.find(r => r.name === role.name);

                    this.logger.debug(existingRole ? `update role: ${role.name}` : `create role: ${role.name}`);

                    existingRole && existingRole.id && existingRole.name
                        ? await this.update((client as any).id, role)
                        : await this.create((client as any).id, role);
                }),
            );
        }
    }

    async create(clientId: string, role: RoleRepresentation) {
        await this.keycloakAdmin.api.clients.createRole({
            ...role,
            id: clientId,
            realm: config.get('keycloak.realm'),
        });

        await this.addComposites(clientId, role);
    }

    async update(clientId: string, role: RoleRepresentation) {
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

    async addComposites(clientId: string, role: RoleRepresentation) {
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
}
