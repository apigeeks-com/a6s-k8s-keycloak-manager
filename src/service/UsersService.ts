import * as prettyjson from 'prettyjson';
import { Inject, Service } from 'typedi';
import { Logger } from 'log4js';
import { InjectLogger } from '../decorator';
import { RoleMappingPayload } from 'keycloak-admin/lib/defs/roleRepresentation';
import { IKeycloakUser } from '../interface';
import { RolesService } from './RolesService';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import { ProcessException } from '../exception';
import { config } from '../utils/config';
import { KeycloakClient } from '../KeycloakClient';

@Service()
export class UsersService {
    @Inject()
    private rolesService!: RolesService;

    @InjectLogger('services/UsersService')
    private logger!: Logger;

    async create(keycloakClient: KeycloakClient, { password, ...user }: IKeycloakUser) {
        this.logger.debug(`Create user: \n${prettyjson.render(user)}`);
        await keycloakClient.users.create({ ...user, realm: config.get('keycloak.realm') });

        this.logger.debug('Set user password');

        const userFound = (await this.findOne(keycloakClient, user.email)) as IKeycloakUser;

        await keycloakClient.users.resetPassword({
            realm: config.get('keycloak.realm'),
            id: userFound.id,
            credential: {
                temporary: false,
                type: 'password',
                value: password,
            },
        });
    }

    async update(keycloakClient: KeycloakClient, id: string, { password, ...user }: IKeycloakUser) {
        this.logger.debug(`Update user: \n${prettyjson.render(user)}`);
        await keycloakClient.users.update({ id, realm: config.get('keycloak.realm') }, user);
    }

    async updateOrCreate(keycloakClient: KeycloakClient, associatedUsers: IKeycloakUser[]) {
        this.logger.debug(`Create or update users: \n${prettyjson.render(associatedUsers)}`);

        associatedUsers.map(async user => {
            let userFound = (await this.findOne(keycloakClient, (user as any).email)) as IKeycloakUser;

            if (userFound && userFound.id) {
                await this.update(keycloakClient, userFound.id, { ...userFound, password: user.password });
            } else {
                await this.create(keycloakClient, user);
                userFound = (await this.findOne(keycloakClient, (user as any).email)) as IKeycloakUser;
            }

            // Append to group
            if (userFound && user.groups && Array.isArray(user.groups)) {
                const groups = await keycloakClient.groups.find({ realm: config.get('keycloak.realm') });

                await Promise.all(
                    user.groups.map(async groupName => {
                        this.logger.debug(`Assign group for user: ${groupName}`);

                        const group = groups.find(g => g.name === groupName);

                        if (group) {
                            keycloakClient.users.addToGroup({
                                id: userFound.id,
                                realm: config.get('keycloak.realm'),
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
                        const clientList = await keycloakClient.clients.find({
                            realm: config.get('keycloak.realm'),
                            clientId: clientName,
                        });

                        if (!clientList.length) {
                            throw new ProcessException(`Client ${clientName} not found`);
                        }

                        const client: ClientRepresentation | any = clientList.pop();

                        const appendRoles = await this.rolesService.findClientRoles(keycloakClient, client, roles);

                        if (appendRoles && appendRoles.length) {
                            // TODO: It may be necessary to remove irrelevant roles.
                            await keycloakClient.users.addClientRoleMappings({
                                realm: config.get('keycloak.realm'),
                                id: (userFound as any).id,
                                clientUniqueId: (client as any).id,
                                roles: <RoleMappingPayload[]>appendRoles,
                            });
                        }
                    }),
                );
            }

            if (userFound && user.realmRoles) {
                this.logger.debug(`Realm role mappings for user: ${user.email}`);
                const appendRoles = await this.rolesService.findRealmRoles(keycloakClient, user.realmRoles);

                if (appendRoles && appendRoles.length) {
                    await keycloakClient.users.addRealmRoleMappings({
                        realm: config.get('keycloak.realm'),
                        id: (userFound as any).id,
                        roles: <RoleMappingPayload[]>appendRoles,
                    });
                }
            }
        });
    }

    private async findOne(keycloakClient: KeycloakClient, email: string) {
        this.logger.debug(`Find user by email: ${email}`);
        const users = await keycloakClient.users.find({ email: email, realm: config.get('keycloak.realm') });

        if (users.length) {
            return users.pop();
        }
    }
}
