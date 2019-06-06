import * as prettyjson from 'prettyjson';
import { Inject, Service } from 'typedi';
import { Logger } from 'log4js';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import GroupRepresentation from 'keycloak-admin/lib/defs/groupRepresentation';
import RoleRepresentation from 'keycloak-admin/lib/defs/roleRepresentation';
import { ClientRoleService } from './ClientRoleService';
import { ClientRoleMappersService } from './ClientRoleMappersService';
import { RealmRoleMappersService } from './RealmRoleMappersService';
import { UsersService } from './UsersService';
import { GroupService } from './GroupService';
import { ClientScopeService } from './ClientScopeService';
import { IKeycloakClientResourceSpec, IKeycloakUser, IKeycloakScope } from '../interface';
import { InjectLogger } from '../decorator';
import { config } from '../utils/config';
import { RolesService } from './RolesService';
import { ProcessException } from '../exception';
import { RealmRoleService } from './RealmRoleService';
import { KeycloakClient } from '../KeycloakClient';

@Service()
export class ClientService {
    @Inject()
    private clientRoleService!: ClientRoleService;

    @Inject()
    private realmRoleService!: RealmRoleService;

    @Inject()
    private clientRoleMappersService!: ClientRoleMappersService;

    @Inject()
    private realmRoleMappersService!: RealmRoleMappersService;

    @Inject()
    private usersService!: UsersService;

    @Inject()
    private groupService!: GroupService;

    @Inject()
    private clientScopesService!: ClientScopeService;

    @Inject()
    private rolesService!: RolesService;

    @InjectLogger('services/ClientService')
    private logger!: Logger;

    generateClientAttributes(
        namespace: string,
        existingAttributes: { [key: string]: string },
    ): { [key: string]: string } {
        let clientAttributes: { [key: string]: string } = {
            ...existingAttributes,
            namespace: namespace, // TODO: move attribute name to config
        };

        if (config.has('keycloak.clientAttributes')) {
            clientAttributes = {
                ...clientAttributes,
                ...config.get('keycloak.clientAttributes'),
            };
        }

        return clientAttributes;
    }

    async create(
        keycloakClient: KeycloakClient,
        {
            clientRoles,
            realmRoleMappers,
            clientRoleMappers,
            associatedUsers,
            associatedGroups,
            clientScopes,
            scopeRealmMappers,
            realmRoles,
            ...clientOptions
        }: IKeycloakClientResourceSpec,
        namespace: string,
    ) {
        await this.processingBeforeCreate(keycloakClient, realmRoles, clientScopes);

        clientOptions.attributes = this.generateClientAttributes(namespace, {});

        this.logger.debug(`Create client: \n${prettyjson.render(clientOptions)}`);

        await keycloakClient.clients.create({ ...clientOptions, realm: config.get('keycloak.realm') });

        const client = await this.findOne(keycloakClient, clientOptions.clientId);

        if (client) {
            await this.processingAfterCreate(
                keycloakClient,
                client,
                clientRoles,
                realmRoleMappers,
                clientRoleMappers,
                associatedUsers,
                associatedGroups,
                scopeRealmMappers,
            );
        }
    }

    async update(
        keycloakClient: KeycloakClient,
        {
            clientRoles,
            realmRoleMappers,
            clientRoleMappers,
            associatedUsers,
            associatedGroups,
            clientScopes,
            scopeRealmMappers,
            realmRoles,
            ...clientOptions
        }: IKeycloakClientResourceSpec,
        namespace: string,
    ) {
        const client = await this.findOne(keycloakClient, clientOptions.clientId);

        if (!client) {
            throw new ProcessException(`Client "${clientOptions.clientId}" not found`);
        }

        if (client && client.id) {
            await this.processingBeforeCreate(keycloakClient, realmRoles, clientScopes);

            clientOptions.attributes = this.generateClientAttributes(namespace, client.attributes || {});

            this.logger.debug(`Update client: \n${prettyjson.render(clientOptions)}`);

            await keycloakClient.clients.update({ id: client.id, realm: config.get('keycloak.realm') }, clientOptions);
            await this.processingAfterCreate(
                keycloakClient,
                client,
                clientRoles,
                realmRoleMappers,
                clientRoleMappers,
                associatedUsers,
                associatedGroups,
                scopeRealmMappers,
            );
        }
    }

    async remove(
        keycloakClient: KeycloakClient,
        {
            clientRoles,
            realmRoleMappers,
            clientRoleMappers,
            associatedUsers,
            associatedGroups,
            clientScopes,
            scopeRealmMappers,
            realmRoles,
            ...clientOptions
        }: IKeycloakClientResourceSpec,
    ) {
        const client = await this.findOne(keycloakClient, clientOptions.clientId);

        if (!client) {
            throw new ProcessException(`Client "${clientOptions.clientId}" not found`);
        }

        if (client && client.id) {
            this.logger.debug(`Remove client: \n${prettyjson.render(clientOptions)}`);
            await keycloakClient.clients.del({ id: client.id, realm: config.get('keycloak.realm') });
            // TODO: need remove users and groups
        }
    }

    async createOrUpdate(
        keycloakClient: KeycloakClient,
        {
            clientRoles,
            realmRoleMappers,
            clientRoleMappers,
            associatedUsers,
            associatedGroups,
            clientScopes,
            scopeRealmMappers,
            realmRoles,
            ...clientOptions
        }: IKeycloakClientResourceSpec,
        namespace: string,
    ) {
        this.logger.debug(`Create or update client: ${clientOptions.clientId}`);

        const client = await this.findOne(keycloakClient, clientOptions.clientId);

        if (client) {
            await this.update(
                keycloakClient,
                {
                    ...clientOptions,
                    clientRoles,
                    realmRoleMappers,
                    clientRoleMappers,
                    associatedUsers,
                    associatedGroups,
                    clientScopes,
                    scopeRealmMappers,
                    realmRoles,
                },
                namespace,
            );
        } else {
            await this.create(
                keycloakClient,
                {
                    ...clientOptions,
                    clientRoles,
                    realmRoleMappers,
                    clientRoleMappers,
                    associatedUsers,
                    associatedGroups,
                    clientScopes,
                    scopeRealmMappers,
                    realmRoles,
                },
                namespace,
            );
        }
    }

    private async findOne(keycloakClient: KeycloakClient, clientId: string) {
        this.logger.debug(`Find client by id: ${clientId}`);

        const clients = await keycloakClient.clients.find({
            clientId,
            realm: config.get('keycloak.realm'),
        });

        if (clients.length) {
            const client = clients.pop();

            this.logger.debug(`Client found: \n${prettyjson.render(client)}`);

            return client;
        }
    }

    private async processingBeforeCreate(
        keycloakClient: KeycloakClient,
        realmRoles?: RoleRepresentation[],
        clientScopes?: IKeycloakScope[],
    ) {
        if (clientScopes) {
            await this.clientScopesService.updateOrCreate(keycloakClient, clientScopes);
        }

        if (realmRoles) {
            await this.realmRoleService.updateOrCreate(keycloakClient, realmRoles);
        }
    }

    private async processingAfterCreate(
        keycloakClient: KeycloakClient,
        client: ClientRepresentation,
        clientRoles?: RoleRepresentation[],
        realmRoleMappers?: string[],
        clientRoleMappers?: string[],
        associatedUsers?: IKeycloakUser[],
        associatedGroups?: GroupRepresentation[],
        scopeRealmMappers?: string[],
    ) {
        if (clientRoles) {
            await this.clientRoleService.updateOrCreate(keycloakClient, clientRoles, client);
        }

        if (realmRoleMappers) {
            await this.realmRoleMappersService.mapping(keycloakClient, realmRoleMappers, client);
        }

        if (clientRoleMappers) {
            await this.clientRoleMappersService.mapping(keycloakClient, clientRoleMappers, client);
        }

        if (associatedGroups) {
            await this.groupService.updateOrCreate(keycloakClient, associatedGroups);
        }

        if (associatedUsers) {
            await this.usersService.updateOrCreate(keycloakClient, associatedUsers);
        }

        if (scopeRealmMappers) {
            const roles = await this.rolesService.findRealmRoles(keycloakClient, scopeRealmMappers);

            if (roles.length) {
                await keycloakClient.clientScopeMappings.realmRoleClientMappings({
                    clientId: (client as any).id,
                    roles,
                });
            }
        }
    }
}
