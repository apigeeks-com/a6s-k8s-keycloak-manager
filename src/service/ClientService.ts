import * as prettyjson from 'prettyjson';
import { Inject, Service } from 'typedi';
import { Logger } from 'log4js';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import GroupRepresentation from 'keycloak-admin/lib/defs/groupRepresentation';
import RoleRepresentation from 'keycloak-admin/lib/defs/roleRepresentation';
import { KeycloakAdminService } from './KeycloakAdminService';
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

@Service()
export class ClientService {
    @Inject()
    private keycloakAdmin!: KeycloakAdminService;

    @Inject()
    private clientRoleService!: ClientRoleService;

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

    async create({
        clientRoles,
        realmRoleMappers,
        clientRoleMappers,
        associatedUsers,
        associatedGroups,
        clientScopes,
        scopeRealmMappers,
        ...clientOptions
    }: IKeycloakClientResourceSpec) {
        await this.keycloakAdmin.auth();
        await this.processingBeforeCreate(clientScopes);

        this.logger.debug(`Create client: \n${prettyjson.render(clientOptions)}`);
        await this.keycloakAdmin.api.clients.create(clientOptions);

        const client = await this.findOne(clientOptions.clientId);

        if (client) {
            await this.processingAfterCreate(
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

    async update({
        clientRoles,
        realmRoleMappers,
        clientRoleMappers,
        associatedUsers,
        associatedGroups,
        clientScopes,
        scopeRealmMappers,
        ...clientOptions
    }: IKeycloakClientResourceSpec) {
        await this.keycloakAdmin.auth();

        const client = await this.findOne(clientOptions.clientId);

        if (!client) {
            throw new ProcessException(`Client "${clientOptions.clientId}" not found`);
        }

        if (client && client.id) {
            await this.processingBeforeCreate(clientScopes);

            this.logger.debug(`Update client: \n${prettyjson.render(clientOptions)}`);

            await this.keycloakAdmin.api.clients.update({ id: client.id }, clientOptions);
            await this.processingAfterCreate(
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

    async remove({
        clientRoles,
        realmRoleMappers,
        clientRoleMappers,
        associatedUsers,
        associatedGroups,
        clientScopes,
        scopeRealmMappers,
        ...clientOptions
    }: IKeycloakClientResourceSpec) {
        await this.keycloakAdmin.auth();

        const client = await this.findOne(clientOptions.clientId);

        if (!client) {
            throw new ProcessException(`Client "${clientOptions.clientId}" not found`);
        }

        if (client && client.id) {
            this.logger.debug(`Remove client: \n${prettyjson.render(clientOptions)}`);
            await this.keycloakAdmin.api.clients.del({ id: client.id });
            // TODO: need remove users and groups
        }
    }

    async createOrUpdate({
        clientRoles,
        realmRoleMappers,
        clientRoleMappers,
        associatedUsers,
        associatedGroups,
        clientScopes,
        scopeRealmMappers,
        ...clientOptions
    }: IKeycloakClientResourceSpec) {
        this.logger.debug(`Create or update client: ${clientOptions.clientId}`);
        await this.keycloakAdmin.auth();
        const client = await this.findOne(clientOptions.clientId);

        if (client) {
            await this.update({
                ...clientOptions,
                clientRoles,
                realmRoleMappers,
                clientRoleMappers,
                associatedUsers,
                associatedGroups,
                clientScopes,
                scopeRealmMappers,
            });
        } else {
            await this.create({
                ...clientOptions,
                clientRoles,
                realmRoleMappers,
                clientRoleMappers,
                associatedUsers,
                associatedGroups,
                clientScopes,
                scopeRealmMappers,
            });
        }
    }

    private async findOne(clientId: string) {
        this.logger.debug(`Find client by id: ${clientId}`);

        const clients = await this.keycloakAdmin.api.clients.find({
            clientId,
            realm: config.get('keycloak.realm'),
        });

        if (clients.length) {
            const client = clients.pop();

            this.logger.debug(`Client found: \n${prettyjson.render(client)}`);

            return client;
        }
    }

    private async processingBeforeCreate(clientScopes?: IKeycloakScope[]) {
        if (clientScopes) {
            await this.clientScopesService.updateOrCreate(clientScopes);
        }
    }

    private async processingAfterCreate(
        client: ClientRepresentation,
        clientRoles?: RoleRepresentation[],
        realmRoleMappers?: string[],
        clientRoleMappers?: string[],
        associatedUsers?: IKeycloakUser[],
        associatedGroups?: GroupRepresentation[],
        scopeRealmMappers?: string[],
    ) {
        if (clientRoles) {
            await this.clientRoleService.updateOrCreate(clientRoles, client);
        }

        if (realmRoleMappers) {
            await this.realmRoleMappersService.mapping(realmRoleMappers, client);
        }

        if (clientRoleMappers) {
            await this.clientRoleMappersService.mapping(clientRoleMappers, client);
        }

        if (associatedGroups) {
            await this.groupService.updateOrCreate(associatedGroups);
        }

        if (associatedUsers) {
            await this.usersService.updateOrCreate(associatedUsers);
        }

        if (scopeRealmMappers) {
            const roles = await this.rolesService.findRealmRoles(scopeRealmMappers);

            if (roles.length) {
                await this.keycloakAdmin.api.clientScopeMappings.realmRoleClientMappings({
                    clientId: (client as any).id,
                    roles,
                });
            }
        }
    }
}
