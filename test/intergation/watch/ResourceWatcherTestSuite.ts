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
        await this.applyResource('client-create-v2.yml');
        await this.awaitWatcherEvent(WatcherEvent.ADDED);

        // verify client to be created
        let client = await this.findClient('test-client');
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
        await this.applyResource('client-update-v2.yml');
        await this.awaitWatcherEvent(WatcherEvent.MODIFIED);

        client = await this.findClient('test-client');
        assert(client, 'Client not found');
        assert.equal((client as ClientRepresentation).enabled, false);

        // delete
        await this.deleteResource('test-client');
        await this.awaitWatcherEvent(WatcherEvent.DELETED);

        client = await this.findClient('test-client');
        assert(!client);
    }

    @test()
    async lifecicleWithSecretKeyRef() {
        // create
        await this.applyResource('client-create-with-secret-v2.yml');
        await this.awaitWatcherEvent(WatcherEvent.ADDED);

        // verify client to be created
        let clientSecret = await this.findClientSecret('test-client-with-secret-ref');
        assert.strictEqual(clientSecret.value, 'a9609ee1-675a-4516-8b22-49a0c7845e3a');

        // update
        await this.applyResource('client-update-with-secret-v2.yml');
        await this.awaitWatcherEvent(WatcherEvent.MODIFIED);

        let client = await this.findClient('test-client-with-secret-ref');
        assert(client, 'Client not found');
        assert.equal((client as ClientRepresentation).enabled, false);
        clientSecret = await this.findClientSecret('test-client-with-secret-ref');
        assert.strictEqual(clientSecret.value, '1aba2c5f-cc9e-4870-80da-8c8c9b793feb');

        // delete
        await this.deleteResource('test-client-with-secret-ref');
        await this.awaitWatcherEvent(WatcherEvent.DELETED);

        client = await this.findClient('test-client-with-secret-ref');
        assert(!client);
    }
}
