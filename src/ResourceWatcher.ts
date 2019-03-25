import { Container } from 'typedi';
import { intersection, sum } from 'lodash';
import { EventEmitter } from 'events';
import { APIRequestProcessor, WatchRequestProcessor, IWatchHandlers } from '@fireblink/k8s-api-client';
import { ClientService, KeycloakAdminService } from './service';
import { IKeycloakClientResource } from './interface';
import { getLogger } from 'log4js';
import { AuthException, ClientException, HttpException } from './exception';
import { config } from './utils/config';

const keycloakManagerService = Container.get(ClientService);
const keycloakAdminService = Container.get(KeycloakAdminService);
const logger = getLogger('watch');

export enum WatcherEvent {
    LIST = 'list',
    ADDED = 'added',
    GONE = 'gone',
    MODIFIED = 'modified',
    DELETED = 'deleted',
    ERROR = 'error',
    IGNORING_CLIENT = 'ignoring-client',
    CLEAR_IGNORE_CLIENT = 'clear-ignore-client',
}

export class ResourceWatcher extends EventEmitter {
    private ignoredClientIDs: string[] = [];

    constructor(private namespace: string) {
        super();
    }

    async process() {
        logger.info(`Starting watch abstractions`);

        try {
            const apiVersion = config.get('k8s.resource.apiVersion');
            const resourceUrl = `/apis/${apiVersion}/namespaces/${this.namespace}/${config.get('k8s.resource.name')}`;
            const k8sApiRequest = new APIRequestProcessor();
            const response = await k8sApiRequest.getAll(resourceUrl);

            this.emit(WatcherEvent.LIST, response.items);

            if (config.has('keycloak.clientAttributes')) {
                await keycloakAdminService.auth();

                const clients = await keycloakAdminService.api.clients.find({
                    realm: config.get('keycloak.realm'),
                });

                const notFoundClientAbstractions = clients.filter(c => {
                    if (!c.attributes || !c.attributes.namespace) {
                        return false;
                    }

                    const clientAttributes: { [key: string]: string } = {
                        ...config.get('keycloak.clientAttributes'),
                        ...{ namespace: this.namespace },
                    };

                    const intersect = intersection(
                        Object.keys(c.attributes || {}),
                        Object.keys(config.get('keycloak.clientAttributes')),
                    );

                    return (
                        intersect.length === Object.keys(config.get('keycloak.clientAttributes')).length &&
                        c.attributes.namespace === this.namespace &&
                        sum(
                            intersect.map(propertyName =>
                                Number(
                                    c.attributes &&
                                        c.attributes[propertyName] &&
                                        c.attributes[propertyName] === clientAttributes[propertyName],
                                ),
                            ),
                        ) === Object.keys(config.get('keycloak.clientAttributes')).length &&
                        !response.items.find(i => i.spec.clientId === c.clientId)
                    );
                });

                await Promise.all(
                    notFoundClientAbstractions.map(async (c: any) => {
                        logger.info(`Removed clint "${c.clientId}" because abstraction not found`);

                        return await keycloakAdminService.api.clients.del({ id: c.id });
                    }),
                );
            }

            await Promise.all(
                response.items
                    .filter(c => this.ignoredClientIDs.indexOf(c.clientId) === -1)
                    .map(async resourceItem => await this.clientCreateOrUpdate(resourceItem)),
            );

            const watchRequest = new WatchRequestProcessor();
            await watchRequest.watch(
                resourceUrl,
                <IWatchHandlers>{
                    gone: async () => {
                        logger.info(`Gone`);
                        this.emit(WatcherEvent.GONE);

                        setTimeout(() => this.process(), 1000);
                    },

                    added: async (obj: IKeycloakClientResource) => {
                        logger.info(`Added abstraction ${obj.metadata.name}`);

                        await this.clientCreateOrUpdate(obj, true);
                        this.emit(WatcherEvent.ADDED, obj);
                    },

                    modified: async (obj: IKeycloakClientResource) => {
                        logger.info(`Modified abstraction ${obj.metadata.name}`);

                        await this.clientCreateOrUpdate(obj, true);
                        this.emit(WatcherEvent.MODIFIED, obj);
                    },

                    deleted: async (obj: IKeycloakClientResource) => {
                        logger.info(`Deleted abstraction ${obj.metadata.name}`);

                        await keycloakManagerService.remove(obj.spec);
                        this.emit(WatcherEvent.DELETED, obj);
                    },
                },
                response.resourceVersion,
            );
        } catch (e) {
            this.emit(WatcherEvent.ERROR, e);
            logger.error(e.message);

            if (e instanceof AuthException) {
                logger.error('Keycloak auth failed');
            }

            if (e instanceof ClientException) {
                this.ignoredClientIDs.push(e.clientId);
                this.emit(WatcherEvent.IGNORING_CLIENT, e.clientId);

                logger.error(`client "${e.clientId}" added to ignoring list`);
                setTimeout(() => this.process(), 1000);
            } else {
                process.exit(1);
            }
        }
    }

    private clearIgnoreClient(clientId: string) {
        const index = this.ignoredClientIDs.indexOf(clientId);

        if (index > -1) {
            this.ignoredClientIDs.splice(index, 1);
            this.emit(WatcherEvent.CLEAR_IGNORE_CLIENT, clientId);
        }
    }

    private async clientCreateOrUpdate(obj: IKeycloakClientResource, force = false) {
        if (force) {
            this.clearIgnoreClient(obj.spec.clientId);
        }

        try {
            return await keycloakManagerService.createOrUpdate(obj.spec, obj.metadata.namespace);
        } catch (e) {
            if (e instanceof HttpException) {
                throw new ClientException(obj.spec.clientId, e.message);
            }

            throw e;
        }
    }
}
