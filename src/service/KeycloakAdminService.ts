import { Service } from 'typedi';
import { config } from '../utils/config';
import { AuthException } from '../exception';
import { KeycloakClient } from '../client';
import { InjectLogger } from '../decorator';
import { Logger } from 'log4js';

@Service()
export class KeycloakAdminService {
    @InjectLogger('services/ClientService')
    private logger!: Logger;

    private readonly keyCloakAdminClient: KeycloakClient;

    constructor() {
        this.keyCloakAdminClient = new KeycloakClient({});
        this.keyCloakAdminClient.setConfig({
            baseUrl: config.get('keycloak.server_url'),
            realmName: config.get('keycloak.realm'),
        });
    }

    async auth() {
        this.logger.debug('Keycloak authorization');
        try {
            this.keyCloakAdminClient.setConfig({ realmName: config.get('keycloak.masterRealm') });
            await this.keyCloakAdminClient.auth(config.get('keycloak.auth'));
            this.keyCloakAdminClient.setConfig({ realmName: config.get('keycloak.realm') });
        } catch (e) {
            throw new AuthException(e.message);
        }
    }

    get api() {
        this.keyCloakAdminClient.setConfig({ realmName: config.get('keycloak.realm') });

        return this.keyCloakAdminClient;
    }
}
