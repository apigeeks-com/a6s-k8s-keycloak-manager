import 'reflect-metadata';
import 'mocha';
import * as axios from 'axios';
import { assert, expect } from 'chai';
import { Container } from 'typedi';
import { KeycloakAdminService } from '../../src/service';
import { promiseExec } from './utils';
import { ResourceWatcher, WatcherEvent } from '../../src/ResourceWatcher';
import { config } from '../../src/utils/config';
import { HttpException } from '../../src/exception';

axios.default.interceptors.response.use(
    (response: axios.AxiosResponse) => response,
    (error: any) => {
        console.log(error.response); // tslint:disable-line

        return Promise.reject(new HttpException(error.message));
    },
);

const keycloakAdminService = Container.get(KeycloakAdminService);
let watcher: ResourceWatcher;

describe('KeycloakManagerTestSuite', function() {
    before(async () => {
        watcher = new ResourceWatcher('default');
        watcher.process();
    });

    afterEach(async () => {
        const promiseEvent = new Promise((resolve, reject) => {
            watcher.on(WatcherEvent.DELETED, resolve);
            watcher.on(WatcherEvent.ERROR, reject);
        });

        try {
            await promiseExec(`kubectl delete keycloakclients test-client`);
            await promiseEvent;
            watcher.removeAllListeners();
        } catch (e) {
            return Promise.resolve();
        }
    });

    it('Create client', async () => {
        const promiseEvent = new Promise((resolve, reject) => {
            watcher.on(WatcherEvent.ADDED, resolve);
            watcher.on(WatcherEvent.ERROR, reject);
        });

        await promiseExec(`kubectl apply -f ${__dirname}/assets/client-create.yml`);
        await promiseEvent;

        await keycloakAdminService.auth();
        const clients = await keycloakAdminService.api.clients.find();

        const client = clients.find(c => c.clientId === 'test-client');
        assert(client, 'Client not found');
    });

    it('Update client', async () => {
        const createPromiseEvent = new Promise((resolve, reject) => {
            watcher.on(WatcherEvent.ADDED, resolve);
            watcher.on(WatcherEvent.ERROR, reject);
        });

        await promiseExec(`kubectl apply -f ${__dirname}/assets/client-create.yml`);
        await createPromiseEvent;

        const updatePromiseEvent = new Promise((resolve, reject) => {
            watcher.on(WatcherEvent.MODIFIED, resolve);
            watcher.on(WatcherEvent.ERROR, reject);
        });

        await promiseExec(`kubectl apply -f ${__dirname}/assets/client-update.yml`);
        await updatePromiseEvent;

        await keycloakAdminService.auth();
        const clients = await keycloakAdminService.api.clients.find();

        const client = clients.find(c => c.clientId === 'test-client');

        assert.equal((client as any).enabled, false);
    });

    it('Deleted client', async () => {
        const createPromiseEvent = new Promise((resolve, reject) => {
            watcher.on(WatcherEvent.ADDED, resolve);
            watcher.on(WatcherEvent.ERROR, reject);
        });

        await promiseExec(`kubectl apply -f ${__dirname}/assets/client-create.yml`);
        await createPromiseEvent;

        const deletedPromiseEvent = new Promise((resolve, reject) => {
            watcher.on(WatcherEvent.DELETED, resolve);
            watcher.on(WatcherEvent.ERROR, reject);
        });

        await promiseExec(`kubectl delete keycloakclients test-client`);
        await deletedPromiseEvent;

        await keycloakAdminService.auth();
        const clients = await keycloakAdminService.api.clients.find();

        const client = clients.find(c => c.clientId === 'test-client');

        assert.isUndefined(client);
    });

    it('Create realm roles', async () => {
        const createPromiseEvent = new Promise((resolve, reject) => {
            watcher.on(WatcherEvent.ADDED, resolve);
            watcher.on(WatcherEvent.ERROR, reject);
        });

        await promiseExec(`kubectl apply -f ${__dirname}/assets/client-create.yml`);
        await createPromiseEvent;

        await keycloakAdminService.auth();
        const allRoles = await keycloakAdminService.api.roles.find();

        const roles = allRoles
            .filter(c => ['realm-role1', 'realm-role2'].indexOf((c as any).name) !== -1)
            .map(c => c.name);

        expect(roles).to.have.members(['realm-role1', 'realm-role2']);
    });

    it('Create client roles', async () => {
        const createPromiseEvent = new Promise((resolve, reject) => {
            watcher.on(WatcherEvent.ADDED, resolve);
            watcher.on(WatcherEvent.ERROR, reject);
        });

        await promiseExec(`kubectl apply -f ${__dirname}/assets/client-create.yml`);
        await createPromiseEvent;

        await keycloakAdminService.auth();
        const clients = await keycloakAdminService.api.clients.find({
            clientId: 'test-client',
            realm: config.get('keycloak.realm'),
        });

        const client = clients.find(c => c.clientId === 'test-client');

        const clientRoles = await keycloakAdminService.api.clients.listRoles({
            id: (client as any).id,
            realm: config.get('keycloak.realm'),
        });

        const roles = clientRoles
            .filter(c => ['client-role1', 'client-role2', 'client-role3'].indexOf((c as any).name) !== -1)
            .map(c => c.name);

        expect(roles).to.have.members(['client-role1', 'client-role2', 'client-role3']);
    });

    it('Create client scopes', async () => {
        const createPromiseEvent = new Promise((resolve, reject) => {
            watcher.on(WatcherEvent.ADDED, resolve);
            watcher.on(WatcherEvent.ERROR, reject);
        });

        await promiseExec(`kubectl apply -f ${__dirname}/assets/client-create.yml`);
        await createPromiseEvent;

        await keycloakAdminService.auth();
        const clientScopes = await keycloakAdminService.api.clientScope.find();

        expect(clientScopes.map(cs => cs.name))
            .to.be.an('array')
            .that.does.include('foo');
    });
});