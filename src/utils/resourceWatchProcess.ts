import { Container } from 'typedi';
import { intersection, sum } from 'lodash';
import { APIRequestProcessor, WatchRequestProcessor, IWatchHandlers } from '@fireblink/k8s-api-client';
import { ClientService, KeycloakAdminService } from '../service';
import { IKeycloakClientResource } from '../interface';
import { getLogger } from 'log4js';
import { AuthException } from '../exception';
import { config } from './config';

const keycloakManagerService = Container.get(ClientService);
const keycloakAdminService = Container.get(KeycloakAdminService);
const logger = getLogger('watch');

export async function resourceWatchProcess(namespace: string) {
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
            response.items.map(
                async resourceItem => await keycloakManagerService.createOrUpdate(
                    resourceItem.spec, resourceItem.metadata.namespace
                )
            ),
        );

        const watchRequest = new WatchRequestProcessor();

        await watchRequest.watch(
            resourceUrl,
            <IWatchHandlers>{
                gone: async () => {
                    setTimeout(() => resourceWatchProcess(namespace), 1000);
                },

                added: async (obj: IKeycloakClientResource) => {
                    await keycloakManagerService.createOrUpdate(obj.spec, obj.metadata.namespace);
                },

                modified: async (obj: IKeycloakClientResource) => {
                    await keycloakManagerService.createOrUpdate(obj.spec, obj.metadata.namespace);
                },

                deleted: async (obj: IKeycloakClientResource) => {
                    await keycloakManagerService.remove(obj.spec);
                },
            },
            response.resourceVersion,
        );
    } catch (e) {
        if (e instanceof AuthException) {
            console.error(e);
            process.exit(1);
        }

        logger.error(e.message);
        setTimeout(() => resourceWatchProcess(namespace), 1000);
    }
}
