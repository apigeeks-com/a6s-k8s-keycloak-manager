import { Container } from 'typedi';
import { APIRequestProcessor, WatchRequestProcessor, IWatchHandlers } from '@fireblink/k8s-api-client';
import { ClientService } from '../service';
import { IKeycloakClientResource } from '../interface';
import { getLogger } from 'log4js';
import { AuthException, ProcessException } from '../exception';

const keycloakManagerService = Container.get(ClientService);
const k8sApiRequest = new APIRequestProcessor();
const watchRequest = new WatchRequestProcessor();

const logger = getLogger('watch');

export async function resourceWatchProcess(resourceUrl: string) {
    try {
        const response = await k8sApiRequest.getAll(resourceUrl);

        await Promise.all(
            response.items.map(async resourceItem => await keycloakManagerService.createOrUpdate(resourceItem.spec)),
        );

        await watchRequest.watch(
            resourceUrl,
            <IWatchHandlers>{
                gone: async () => {
                    setTimeout(resourceWatchProcess, 1000);
                },

                added: async (obj: IKeycloakClientResource) => {
                    await keycloakManagerService.createOrUpdate(obj.spec);
                },

                modified: async (obj: IKeycloakClientResource) => {
                    await keycloakManagerService.createOrUpdate(obj.spec);
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
        } else if (e instanceof ProcessException) {
            logger.error(e.message);
        } else {
            logger.error(e.message);
        }
    }
}
