import * as prettyjson from 'prettyjson';
import { Inject, Service } from 'typedi';
import { Logger } from 'log4js';
import { InjectLogger } from '../decorator';
import { KeycloakAdminService } from './KeycloakAdminService';
import { RoleMappingPayload } from 'keycloak-admin/lib/defs/roleRepresentation';
import { IKeycloakUser } from '../interface';
import { RolesService } from './RolesService';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import { ProcessException } from '../exception';

@Service()
export class UsersService {
    @Inject()
    private keycloakAdmin!: KeycloakAdminService;

    @Inject()
    private rolesService!: RolesService;

    @InjectLogger('services/UsersService')
    private logger!: Logger;

    async create({ password, ...user }: IKeycloakUser) {
        this.logger.debug(`Create user: \n${prettyjson.render(user)}`);
        await this.keycloakAdmin.api.users.create(user);

        this.logger.debug('Set user password');

        const userFound = (await this.findOne(user.email)) as IKeycloakUser;

        await this.keycloakAdmin.api.users.resetPassword({
            id: userFound.id,
            credential: {
                temporary: false,
                type: 'password',
                value: password,
            },
        });
    }

    async update(id: string, { password, ...user }: IKeycloakUser) {
        this.logger.debug(`Update user: \n${prettyjson.render(user)}`);
        await this.keycloakAdmin.api.users.update({ id }, user);

        this.logger.debug('Update user password');
        await this.keycloakAdmin.api.users.resetPassword({
            id,
            credential: {
                temporary: false,
                type: 'password',
                value: password,
            },
        });
    }

    async updateOrCreate(associatedUsers: IKeycloakUser[]) {
        this.logger.debug(`Create or update users: \n${prettyjson.render(associatedUsers)}`);

        associatedUsers.map(async user => {
            let userFound = (await this.findOne((user as any).email)) as IKeycloakUser;

            if (userFound && userFound.id) {
                await this.update(userFound.id, { ...userFound, password: user.password });
            } else {
                await this.create(user);
                userFound = (await this.findOne((user as any).email)) as IKeycloakUser;
            }

            // Append to group
            if (userFound && user.groups && Array.isArray(user.groups)) {
                const groups = await this.keycloakAdmin.api.groups.find();

                await Promise.all(
                    user.groups.map(async groupName => {
                        this.logger.debug(`Assign group for user: ${groupName}`);

                        const group = groups.find(g => g.name === groupName);

                        if (group) {
                            this.keycloakAdmin.api.users.addToGroup({
                                id: userFound.id,
                                groupId: (group as any).id,
                            });
                        } else {
                            this.logger.error(`Group ${groupName} not found`);
                        }
                    }),
                );
            }

            if (userFound && user.clientRoles) {
                this.logger.debug(`Client role mappings for user: ${user.email}`);
                await Promise.all(
                    Object.entries(user.clientRoles).map(async ([clientName, roles]) => {
                        const clientList = await this.keycloakAdmin.api.clients.find({
                            clientId: clientName,
                        });

                        if (!clientList.length) {
                            throw new ProcessException(`Client ${clientName} not found`);
                        }

                        const client: ClientRepresentation | any = clientList.pop();

                        const appendRoles = await this.rolesService.findClientRoles(client, roles);

                        if (appendRoles) {
                            // TODO: It may be necessary to remove irrelevant roles.
                            await this.keycloakAdmin.api.users.addClientRoleMappings({
                                id: (userFound as any).id,
                                clientUniqueId: (client as any).id,
                                roles: <RoleMappingPayload[]>appendRoles,
                            });
                        }
                    }),
                );
            }

            // TODO: realm roles mapping
        });
    }

    private async findOne(email: string) {
        this.logger.debug(`Find user by email: ${email}`);
        const users = await this.keycloakAdmin.api.users.find({ email: email });

        if (users.length) {
            return users.pop();
        }
    }
}
