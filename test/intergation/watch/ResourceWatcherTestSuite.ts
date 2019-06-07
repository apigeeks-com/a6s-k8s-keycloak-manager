import { suite, test } from 'mocha-typescript';
import { BaseResourceWatcherTestSuite } from './BaseResourceWatcherTestSuite';
import { WatcherEvent } from '../../../src/ResourceWatcher';
import * as assert from 'assert';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';

@suite()
class ResourceWatcherTestSuite extends BaseResourceWatcherTestSuite {
    @test()
    async lifecicle() {
        // create
        await this.applyCreateResource();
        await this.awaitWatcherEvent(WatcherEvent.ADDED);
        
        // verify client to be created
        let client = await this.findClientInKeycloak();
        assert(client, 'Client not found');

        // verify realm roles to be created
        const realmRoles = await this.findRealRoles();
        const realmRoleNames = ['realm-role1', 'realm-role2'];
        const matchingRealmRoles = realmRoles.filter(c => realmRoleNames.indexOf((c as any).name) !== -1);
        assert.strictEqual(matchingRealmRoles.length, realmRoleNames.length);        

        // verify client roles to be created
        const clientRoles = await this.findClientRoles(client);
        const clientRoleNames = ['client-role1', 'client-role2', 'client-role3'];
        const matchingClientRoles = clientRoles.filter(c => clientRoleNames.indexOf((c as any).name) !== -1);
        assert.strictEqual(matchingClientRoles.length, clientRoleNames.length);

        // verify client scope to be created
        const clientScopes = await this.findClientScopes();
        const matchingClientScopes = clientScopes.filter(c => c.name === 'foo');
        assert.strictEqual(matchingClientScopes.length, 1);        

        // update
        await this.applyUpdateResource();
        await this.awaitWatcherEvent(WatcherEvent.MODIFIED);
        
        client = await this.findClientInKeycloak();
        assert(client, 'Client not found');
        assert.equal((client as ClientRepresentation).enabled, false);

        // delete
        await this.deleteResource();
        await this.awaitWatcherEvent(WatcherEvent.DELETED);

        client = await this.findClientInKeycloak();
        assert(!client);
    }
}
