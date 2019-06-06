import { EventEmitter } from 'events';
import { APIRequestProcessor, WatchRequestProcessor, IWatchHandlers } from '@fireblink/k8s-api-client';
import { IKeycloakClientResource } from './interface';
import { getLogger } from 'log4js';
import { HttpException } from './exception';
import { config } from './utils/config';
import { KeycloakAdminClientProcessor } from './processors/KeycloakAdminClientProcessor';
import { KeycloakClient } from './KeycloakClient';
import Container from 'typedi';
import { ClientService } from './service';

const logger = getLogger('watch');

export enum WatcherEvent {
    LIST = 'list',
    ADDED = 'added',
    MODIFIED = 'modified',
    DELETED = 'deleted',
    ERROR = 'error',
    IGNORING_CLIENT = 'ignoring-client',
    CLEAR_IGNORE_CLIENT = 'clear-ignore-client',
}

export class ResourceWatcher extends EventEmitter {
    private keycloakClientService: ClientService;
    private watchRequest: WatchRequestProcessor;
    private aborted = false;

    constructor(private namespace: string) {
        super();

        this.watchRequest = new WatchRequestProcessor();
        this.keycloakClientService = Container.get(ClientService);
    }

    private get path(): string {
        const resoureNamePlural = config.get('k8s.resource.name');
        const apiVersion = config.get('k8s.resource.apiVersion');

        return `/apis/${apiVersion}/namespaces/${this.namespace}/${resoureNamePlural}`;
    }

    /**
     * Watch for resources
     */
    async start() {
        if (this.aborted) {
            throw new Error('Unable to start. Watch aborted.');
        }

        const resourceVersion = await this.mergeAll();
        await this.watch(resourceVersion);
    }

    /**
     * Abort watch
     */
    async abort() {
        this.watchRequest.abort();
    }

    private async watch(resourceVersion: string): Promise<void> {
        if (this.aborted) {
            return;
        }

        await this.watchRequest.watch(
            this.path,
            <IWatchHandlers>{
                added: async (obj: IKeycloakClientResource) => {
                    logger.info(`Added abstraction ${obj.metadata.name}`);
                    const processor = new KeycloakAdminClientProcessor();
                    const api = await processor.getAPI();
                    await this.clientCreateOrUpdate(api, obj);
                    this.emit(WatcherEvent.ADDED, obj);
                },

                modified: async (obj: IKeycloakClientResource) => {
                    logger.info(`Modified abstraction ${obj.metadata.name}`);
                    const processor = new KeycloakAdminClientProcessor();
                    const api = await processor.getAPI();
                    await this.clientCreateOrUpdate(api, obj);
                    this.emit(WatcherEvent.MODIFIED, obj);
                },

                deleted: async (obj: IKeycloakClientResource) => {
                    logger.info(`Deleted abstraction ${obj.metadata.name}`);
                    const processor = new KeycloakAdminClientProcessor();
                    const api = await processor.getAPI();
                    await this.keycloakClientService.remove(api, obj.spec);
                    this.emit(WatcherEvent.DELETED, obj);
                },
            },
            resourceVersion,
        );
    }

    /**
     * Merge all resources
     */
    private async mergeAll(): Promise<string> {
        const resoureNamePlural = config.get('k8s.resource.name');
        logger.info(`Fetching all ${resoureNamePlural} from k8s to compare with Keycloak`);

        const k8sApiRequest = new APIRequestProcessor();
        const resources = await k8sApiRequest.getAll(this.path);
        this.emit(WatcherEvent.LIST, resources.items);

        const processor = new KeycloakAdminClientProcessor();
        const api = await processor.getAPI();

        const existingClients = await api.clients.find({
            realm: config.get('keycloak.realm'),
        });

        const clientAttributes = this.keycloakClientService.generateClientAttributes(this.namespace, {});

        // first find clients that present in Keycloak but no longer in K8s
        const clientsToRemove = existingClients.filter(c => {
            if (!c.attributes || !c.attributes.namespace) {
                return false;
            }

            for (const name of Object.keys(clientAttributes)) {
                if (!c.attributes[name] || c.attributes[name] !== clientAttributes[name]) {
                    return false;
                }
            }

            const k8sResource = resources.items.find(r => r.clientId === c.clientId);

            return !k8sResource;
        });

        for (const client of clientsToRemove) {
            logger.info(`Removing client "${client.clientId}"`);
            await api.clients.del({ id: client.id || '' });
        }

        // create or update new ones
        for (const client of resources.items) {
            logger.info(`Creating or updating client "${client.clientId}"`);
            await this.clientCreateOrUpdate(api, client);
        }

        return resources.resourceVersion;
    }

    private async clientCreateOrUpdate(keycloakClient: KeycloakClient, obj: IKeycloakClientResource) {
        try {
            return await this.keycloakClientService.createOrUpdate(keycloakClient, obj.spec, obj.metadata.namespace);
        } catch (e) {
            if (e instanceof HttpException) {
                logger.error(`Failed to create or update client ${obj.spec.clientId}`, e);

                return;
            }

            throw e;
        }
    }
}
