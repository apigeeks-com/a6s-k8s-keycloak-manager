import 'reflect-metadata';
import * as axios from 'axios';
import * as log4js from 'log4js';
import { resourceWatchProcess } from './utils/resourceWatchProcess';
import { config } from './utils/config';

log4js.configure(config.get('log4js'));

axios.default.interceptors.response.use(
    (response: axios.AxiosResponse) => response,
    (error: any) => {
        console.log(error.response); // tslint:disable-line
        throw error;
    },
);

const namespaces: string[] = config.get('k8s.namespaces');

namespaces.forEach(async namespace => {
    const apiVersion = config.get('k8s.resource.apiVersion');
    const resourceUrl = `/apis/${apiVersion}/namespaces/${namespace}/${config.get('k8s.resource.name')}`;

    console.log(`namespace: ${namespace}; name: ${config.get('k8s.resource.name')}`); // tslint:disable-line

    resourceWatchProcess(resourceUrl).then(() => {
        console.log(`Watching: ${resourceUrl}`); // tslint:disable-line
    });
});
