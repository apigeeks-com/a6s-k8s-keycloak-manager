import * as prettyjson from 'prettyjson';
import { Inject, Service } from 'typedi';
import { Logger } from 'log4js';
import { ClientRoleService } from './ClientRoleService';
import { ClientRoleMappersService } from './ClientRoleMappersService';
import { RealmRoleMappersService } from './RealmRoleMappersService';
import { UsersService } from './UsersService';
import { GroupService } from './GroupService';
import { ClientScopeService } from './ClientScopeService';
import { IKeycloakClientResourceSpec } from '../interface';
import { InjectLogger } from '../decorator';
import { config } from '../utils/config';
import { RolesService } from './RolesService';
import { ProcessException } from '../exception';
import { RealmRoleService } from './RealmRoleService';
import { KeycloakClient } from '../KeycloakClient';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import { APIRequestProcessor } from '@fireblink/k8s-api-client';

@Service()
export class ClientService {
    @Inject(() => ClientRoleService)
    private clientRoleService!: ClientRoleService;

    @Inject(() => RealmRoleService)
    private realmRoleService!: RealmRoleService;

    @Inject(() => ClientRoleMappersService)
    private clientRoleMappersService!: ClientRoleMappersService;

    @Inject(() => RealmRoleMappersService)
    private realmRoleMappersService!: RealmRoleMappersService;

    @Inject(() => UsersService)
    private usersService!: UsersService;

    @Inject(() => GroupService)
    private groupService!: GroupService;

    @Inject(() => ClientScopeService)
    private clientScopesService!: ClientScopeService;

    @Inject(() => RolesService)
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

    async create(keycloakClient: KeycloakClient, spec: IKeycloakClientResourceSpec, namespace: string) {
        if (!spec.client.clientId) {
            throw new Error('Unable to create client without clientId field');
        }

        await this.processingBeforeCreate(keycloakClient, spec);

        spec.client.attributes = this.generateClientAttributes(namespace, {});

        this.logger.debug(`Create client: \n${prettyjson.render(spec.client)}`);

        await this.resolveSecret(spec.client, namespace);
        await keycloakClient.clients.create({ ...spec.client, realm: config.get('keycloak.realm') });

        const client = await this.findOne(keycloakClient, spec.client.clientId);

        if (!client) {
            throw new Error(`Unable to find client ${spec.client.clientId} after creation`);
        }

        spec.client.id = client.id;
        await this.processingAfterCreate(keycloakClient, spec);
    }

    async update(keycloakClient: KeycloakClient, spec: IKeycloakClientResourceSpec, namespace: string) {
        if (!spec.client.clientId) {
            throw new Error('Unable to update client without clientId field');
        }

        if (!spec.client.id) {
            const client = await this.findOne(keycloakClient, spec.client.clientId);

            if (!client || !client.id) {
                throw new ProcessException(`Client "${spec.client.clientId}" not found`);
            }

            spec.client.id = client.id;
        }

        if (!spec.client.id) {
            throw new Error('Unable to update client without id field');
        }

        await this.resolveSecret(spec.client, namespace);

        await this.processingBeforeCreate(keycloakClient, spec);

        spec.client.attributes = this.generateClientAttributes(namespace, spec.client.attributes || {});

        this.logger.debug(`Update client: \n${prettyjson.render(spec.client)}`);

        await keycloakClient.clients.update({ id: spec.client.id, realm: config.get('keycloak.realm') }, spec.client);
        await this.processingAfterCreate(keycloakClient, spec);
    }

    async resolveSecret(client: ClientRepresentation, namespace: string): Promise<void> {
        if (client.secret && client.secret.hasOwnProperty('secretKeyRef')) {
            const secretKeyRef: { name: string; key: string } = (<any>client.secret).secretKeyRef;
            const api = new APIRequestProcessor();
            const secret = await api.get(`/api/v1/namespaces/${namespace}/secrets/${secretKeyRef.name}`);
            const { data } = secret;

            if (!data[secretKeyRef.key]) {
                throw new Error(`Unable to find key ${secretKeyRef.key} in secret ${secretKeyRef.name}`);
            }

            client.secret = new Buffer(data[secretKeyRef.key], 'base64').toString('utf-8');
        }
    }

    async remove(keycloakClient: KeycloakClient, spec: IKeycloakClientResourceSpec) {
        if (!spec.client.clientId) {
            throw new Error('Unable to remove client without clientId field');
        }

        const client = await this.findOne(keycloakClient, spec.client.clientId);

        if (!client) {
            throw new ProcessException(`Client "${spec.client.clientId}" not found`);
        }

        if (client && client.id) {
            this.logger.debug(`Remove client: \n${prettyjson.render(spec.client)}`);
            await keycloakClient.clients.del({ id: client.id, realm: config.get('keycloak.realm') });
            // TODO: need remove users and groups
        } else {
            this.logger.warn(`Unable to remove client ${spec.client.clientId} - client not found`);
        }
    }

    async createOrUpdate(keycloakClient: KeycloakClient, spec: IKeycloakClientResourceSpec, namespace: string) {
        if (!spec.client.clientId) {
            throw new Error('Unable to create or update client without clientId field');
        }

        this.logger.debug(`Create or update client: ${spec.client.clientId}`);

        const client = await this.findOne(keycloakClient, spec.client.clientId);

        if (client) {
            spec.client.id = client.id;
            await this.update(keycloakClient, spec, namespace);
        } else {
            await this.create(keycloakClient, spec, namespace);
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

    private async processingBeforeCreate(keycloakClient: KeycloakClient, spec: IKeycloakClientResourceSpec) {
        if (spec.clientScopes) {
            await this.clientScopesService.updateOrCreate(keycloakClient, spec.clientScopes);
        }

        if (spec.realmRoles) {
            await this.realmRoleService.updateOrCreate(keycloakClient, spec.realmRoles);
        }
    }

    private async processingAfterCreate(keycloakClient: KeycloakClient, spec: IKeycloakClientResourceSpec) {
        if (!spec.client.id) {
            throw new Error('Unable to process client without ID');
        }

        if (spec.clientRoles) {
            await this.clientRoleService.updateOrCreate(keycloakClient, spec.clientRoles, spec.client);
        }

        if (spec.realmRoleMappers) {
            await this.realmRoleMappersService.mapping(keycloakClient, spec.realmRoleMappers, spec.client);
        }

        if (spec.clientRoleMappers) {
            await this.clientRoleMappersService.mapping(keycloakClient, spec.clientRoleMappers, spec.client);
        }

        if (spec.associatedGroups) {
            await this.groupService.updateOrCreate(keycloakClient, spec.associatedGroups);
        }

        if (spec.associatedUsers) {
            await this.usersService.updateOrCreate(keycloakClient, spec.associatedUsers);
        }

        if (spec.scopeRealmMappers) {
            const roles = await this.rolesService.findRealmRoles(keycloakClient, spec.scopeRealmMappers);

            if (roles.length) {
                await keycloakClient.clientScopeMappings.realmRoleClientMappings({
                    clientId: spec.client.id,
                    roles,
                });
            }
        }
    }
}
