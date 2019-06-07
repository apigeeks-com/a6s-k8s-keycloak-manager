import { ResourceWatcher, WatcherEvent } from '../../../src/ResourceWatcher';
import { promiseExec } from '../utils';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import { KeycloakAdminClientProcessor } from '../../../src/processors/KeycloakAdminClientProcessor';
import RoleRepresentation from 'keycloak-admin/lib/defs/roleRepresentation';
import { config } from '../../../src/utils/config';
import { KeycloakClient } from '../../../src/KeycloakClient';
import { IKeycloakScope } from '../../../src/interface';

export class BaseResourceWatcherTestSuite {
    protected watcher: ResourceWatcher;
    
    async before() {        
        const watcher = this.watcher = new ResourceWatcher('default');
        await watcher.start();
    }

    protected async getKeycloaClient(): Promise<KeycloakClient> {
        const processor = new KeycloakAdminClientProcessor();

        return await processor.getAPI();
    }

    async after() {
        this.watcher.abort();        
    }    

    protected async deleteResource() {
        await promiseExec(`kubectl delete keycloakclients test-client`);
    }

    protected async applyCreateResource() {
        await promiseExec(`kubectl apply -f ${process.cwd()}/test/intergation/assets/client-create-v2.yml`);        
    }

    protected async applyUpdateResource() {
        await promiseExec(`kubectl apply -f ${process.cwd()}/test/intergation/assets/client-update-v2.yml`);        
    }

    protected async awaitWatcherEvent(event: WatcherEvent) {
        await new Promise((resolve, reject) => {
            this.watcher.on(event, resolve);
            this.watcher.on(WatcherEvent.ERROR, reject);
        });
    }

    protected async findClientInKeycloak(): Promise<ClientRepresentation | undefined> {
        const api = await this.getKeycloaClient();
                
        const clients = await api.clients.find({
            clientId: 'test-client'
        });

        return clients[0];
    }

    protected async findRealRoles(): Promise<RoleRepresentation[]> {
        const api = await this.getKeycloaClient();
        
        return await api.roles.find();
    }

    protected async findClientRoles(client: ClientRepresentation): Promise<RoleRepresentation[]> {
        const api = await this.getKeycloaClient();

        return await api.clients.listRoles({
            id: client.id,
            realm: config.get('keycloak.realm'),
        });
    }

    protected async findClientScopes(): Promise<IKeycloakScope[]> {
        const api = await this.getKeycloaClient();    

        return await api.clientScope.find();        
    }
}
