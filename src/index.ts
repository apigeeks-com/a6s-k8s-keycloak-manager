import 'reflect-metadata';
import * as axios from 'axios';
import * as log4js from 'log4js';
import { ResourceWatcher } from './ResourceWatcher';
import { config } from './utils/config';
import { HttpException } from './exception';

log4js.configure(config.get('log4js'));

process.on('unhandledRejection', (reason, p) => {
    console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
    process.exit(1);
});

axios.default.interceptors.response.use(
    (response: axios.AxiosResponse) => response,
    (error: any) => {
        console.log(error.response); // tslint:disable-line

        return Promise.reject(new HttpException(error.message));
    },
);

const namespaces: string[] = config.get('k8s.namespaces');

namespaces.forEach(async namespace => {
    const watcher = new ResourceWatcher(namespace);
    await watcher.start();

    console.log(`Watching: ${namespace}`); // tslint:disable-line
});
