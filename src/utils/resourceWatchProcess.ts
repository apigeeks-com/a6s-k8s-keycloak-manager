import { Container } from 'typedi';
import { intersection, sum } from 'lodash';
import { APIRequestProcessor, WatchRequestProcessor, IWatchHandlers } from '@fireblink/k8s-api-client';
import { ClientService, KeycloakAdminService } from '../service';
import { IKeycloakClientResource } from '../interface';
import { getLogger } from 'log4js';
import { AuthException, ClientException, HttpException } from '../exception';
import { config } from './config';

const keycloakManagerService = Container.get(ClientService);
const keycloakAdminService = Container.get(KeycloakAdminService);
const logger = getLogger('watch');

const ignoringClients: string[] = [];

function clearIgnoreClient(clientId: string) {
    const index = ignoringClients.indexOf(clientId);

    if (index > -1) {
        ignoringClients.splice(index, 1);
    }
}

async function clientCreateOrUpdate(obj: IKeycloakClientResource, isClearIgnoring = false) {
    if (isClearIgnoring) {
        clearIgnoreClient(obj.spec.clientId);
    }

    try {
        return await keycloakManagerService.createOrUpdate(
            obj.spec, obj.metadata.namespace
        );
    } catch (e) {
        if (e instanceof HttpException) {
            throw new ClientException(obj.spec.clientId, e.message);
        }

        throw e;
    }
}

export async function resourceWatchProcess(namespace: string) {
    logger.info(`Starting watch abstractions`);

    try {
        const apiVersion = config.get('k8s.resource.apiVersion');
        const resourceUrl = `/apis/${apiVersion}/namespaces/${namespace}/${config.get('k8s.resource.name')}`;
        const k8sApiRequest = new APIRequestProcessor();
        const response = await k8sApiRequest.getAll(resourceUrl);

        if (config.has('keycloak.clientAttributes')) {
            await keycloakAdminService.auth();

            const clients = await keycloakAdminService.api.clients.find({
                realm: config.get('keycloak.realm')
            });

            const notFoundClientAbstractions = clients.filter((c) => {
                if (!c.attributes || !c.attributes.namespace) {
                    return false;
                }

                const clientAttributes: {[key: string]: string} = {
                    ...config.get('keycloak.clientAttributes'),
                    ...{namespace}
                };

                const intersect = intersection(
                    Object.keys(c.attributes || {}),
                    Object.keys(config.get('keycloak.clientAttributes'))
                );

                return intersect.length === Object.keys(config.get('keycloak.clientAttributes')).length &&
                    c.attributes.namespace === namespace &&
                    sum(intersect
                        .map(propertyName => Number(
                            c.attributes &&
                            c.attributes[propertyName] &&
                            c.attributes[propertyName] === clientAttributes[propertyName]
                        ))
                    ) === Object.keys(config.get('keycloak.clientAttributes')).length &&
                    !response.items.find(i => i.spec.clientId === c.clientId)
                ;
            });

            await Promise.all(
                notFoundClientAbstractions.map(async (c: any) => {
                    logger.info(`Removed clint "${c.clientId}" because abstraction not found`);

                    return await keycloakAdminService.api.clients.del({id: c.id});
                })
            );
        }

        await Promise.all(
            response.items
                .filter(c => ignoringClients.indexOf(c.clientId) === -1)
                .map(async resourceItem => await clientCreateOrUpdate(resourceItem)),
        );

        const watchRequest = new WatchRequestProcessor();

        await watchRequest.watch(
            resourceUrl,
            <IWatchHandlers>{
                gone: async () => {
                    logger.info(`Gone`);

                    setTimeout(() => resourceWatchProcess(namespace), 1000);
                },

                added: async (obj: IKeycloakClientResource) => {
                    logger.info(`Added abstraction ${obj.metadata.name}`);

                    return await clientCreateOrUpdate(obj, true);
                },

                modified: async (obj: IKeycloakClientResource) => {
                    logger.info(`Modified abstraction ${obj.metadata.name}`);

                    return await clientCreateOrUpdate(obj, true);
                },

                deleted: async (obj: IKeycloakClientResource) => {
                    logger.info(`Deleted abstraction ${obj.metadata.name}`);

                    await keycloakManagerService.remove(obj.spec);
                },
            },
            response.resourceVersion,
        );
    } catch (e) {
        logger.error(e.message);

        if (e instanceof AuthException) {
            logger.error('Keycloak auth failed');
        }

        if (e instanceof ClientException) {
            ignoringClients.push(e.clientId);
            logger.error(`client "${e.clientId}" added to ignoring list`);
            setTimeout(() => resourceWatchProcess(namespace), 1000);
        } else {
            process.exit(1);
        }
    }
}
