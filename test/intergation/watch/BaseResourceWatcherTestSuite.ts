import { ResourceWatcher, WatcherEvent } from '../../../src/ResourceWatcher';
import { promiseExec } from '../utils';
import { KeycloakAdminClientProcessor } from '../../../src/processors/KeycloakAdminClientProcessor';
import { config } from '../../../src/utils/config';
import { KeycloakClient } from '../../../src/KeycloakClient';
import { IKeycloakScope } from '../../../src/interface';

import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import RoleRepresentation from 'keycloak-admin/lib/defs/roleRepresentation';
import CredentialRepresentation from 'keycloak-admin/lib/defs/credentialRepresentation';

export class BaseResourceWatcherTestSuite {
    protected watcher: ResourceWatcher;
    private lastError?: Error;
    before() {
        const watcher = (this.watcher = new ResourceWatcher('default'));
        this.lastError = null;
        watcher.start().catch(e => {
            this.lastError = e;
        });
    }

    protected async getKeycloaClient(): Promise<KeycloakClient> {
        const processor = new KeycloakAdminClientProcessor();

        return await processor.getAPI();
    }

    async after() {
        this.watcher.abort();
    }

    protected async deleteResource(name: string) {
        console.log(`-> Removing resource: ${name}`);
        await promiseExec(`kubectl delete keycloakclients ${name}`);
    }

    protected async applyResource(fileName: string) {
        console.log(`-> Applying resource from file: ${fileName}`);
        await promiseExec(`kubectl apply -f ${process.cwd()}/test/intergation/assets/${fileName}`);
    }

    protected async awaitWatcherEvent(event: WatcherEvent) {
        await new Promise((resolve, rejected) => {
            if (this.lastError) {
                return rejected(this.lastError);
            }

            this.watcher.on(event, resolve);
            this.watcher.on(WatcherEvent.ERROR, rejected);
        });
    }

    protected async findClient(clientId: string): Promise<ClientRepresentation | undefined> {
        console.log('-> looking for client');
        const api = await this.getKeycloaClient();

        const clients = await api.clients.find({
            clientId,
        });

        return clients[0];
    }

    protected async findClientSecret(clientId: string): Promise<CredentialRepresentation | undefined> {
        console.log('-> looking for client');
        const api = await this.getKeycloaClient();

        const clients = await api.clients.find({
            clientId,
        });

        return await api.clients.getClientSecret({
            id: clients[0].id,
        });
    }

    protected async findRealRoles(): Promise<RoleRepresentation[]> {
        console.log('-> looking for realm roles');
        const api = await this.getKeycloaClient();

        return await api.roles.find();
    }

    protected async findClientRoles(client: ClientRepresentation): Promise<RoleRepresentation[]> {
        console.log('-> looking for client roles');
        const api = await this.getKeycloaClient();

        return await api.clients.listRoles({
            id: client.id,
            realm: config.get('keycloak.realm'),
        });
    }

    protected async findClientScopes(): Promise<IKeycloakScope[]> {
        console.log('-> looking for client scopes');
        const api = await this.getKeycloaClient();

        return await api.clientScope.find();
    }
}
