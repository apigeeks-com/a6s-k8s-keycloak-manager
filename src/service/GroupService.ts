import * as prettyjson from 'prettyjson';
import { Logger } from 'log4js';
import { Inject, Service } from 'typedi';
import { RoleMappingPayload } from 'keycloak-admin/lib/defs/roleRepresentation';
import GroupRepresentation from 'keycloak-admin/lib/defs/groupRepresentation';
import { InjectLogger } from '../decorator';
import { KeycloakAdminService } from './KeycloakAdminService';
import { RolesService } from './RolesService';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import { ProcessException } from '../exception';
import { config } from '../utils/config';

@Service()
export class GroupService {
    @Inject()
    private keycloakAdmin!: KeycloakAdminService;

    @Inject()
    private rolesService!: RolesService;

    @InjectLogger('services/GroupService')
    private logger!: Logger;

    async create(group: GroupRepresentation) {
        this.logger.debug(`Create group: \n${prettyjson.render(group)}`);
        await this.keycloakAdmin.api.groups.create({ ...group, realm: config.get('keycloak.realm') });
    }

    async update(id: string, group: GroupRepresentation) {
        this.logger.debug(`Update group: \n${prettyjson.render(group)}`);
        await this.keycloakAdmin.api.groups.update({ id, realm: config.get('keycloak.realm') }, group);
    }

    async updateOrCreate(associatedGroups: GroupRepresentation[]) {
        this.logger.debug(`Create or update groups: \n${prettyjson.render(associatedGroups)}`);

        associatedGroups.map(async group => {
            let foundGroup: any = await this.findOne((group as any).name);

            if (foundGroup) {
                await this.update(foundGroup.id, group);
            } else {
                await this.create(group);
                foundGroup = await this.findOne((group as any).name);
            }

            if (foundGroup && group.clientRoles) {
                this.logger.debug(`Client role mappings for group: ${group.name}`);
                await Promise.all(
                    Object.entries(group.clientRoles).map(async ([clientName, roles]) => {
                        const clientList = await this.keycloakAdmin.api.clients.find({
                            realm: config.get('keycloak.realm'),
                            clientId: clientName,
                        });

                        if (!clientList.length) {
                            throw new ProcessException(`Client ${clientName} not found`);
                        }

                        const client: ClientRepresentation | any = clientList.pop();

                        const appendRoles = await this.rolesService.findClientRoles(client, roles);

                        if (appendRoles) {
                            // TODO: It may be necessary to remove irrelevant roles.
                            await this.keycloakAdmin.api.groups.addClientRoleMappings({
                                id: foundGroup.id,
                                clientUniqueId: (client as any).id,
                                roles: <RoleMappingPayload[]>appendRoles,
                                realm: config.get('keycloak.realm'),
                            });
                        }
                    }),
                );
            }

            // TODO: realm roles mapping
        });
    }

    private async findOne(name: string) {
        this.logger.debug(`Find group by name: ${name}`);

        const list = await this.keycloakAdmin.api.groups.find({ realm: config.get('keycloak.realm') });

        if (list) {
            const group = list.find(g => g.name === name);

            if (group) {
                this.logger.debug(`Group found: \n${prettyjson.render(group)}`);

                return group;
            }
        }
    }
}
