import { config } from '../utils/config';
import { AuthException } from '../exception';
import { KeycloakClient } from '../KeycloakClient';

export class KeycloakAdminClientProcessor {
    private readonly keyCloakAdminClient: KeycloakClient;
    private authenticated = false;

    constructor() {
        this.keyCloakAdminClient = new KeycloakClient({});
        this.keyCloakAdminClient.setConfig({
            baseUrl: config.get('keycloak.server_url'),
            realmName: config.get('keycloak.realm'),
        });
    }

    /**
     * Authenticate client
     */
    async auth() {
        try {
            this.keyCloakAdminClient.setConfig({ realmName: config.get('keycloak.masterRealm') });
            await this.keyCloakAdminClient.auth(config.get('keycloak.auth'));
            this.keyCloakAdminClient.setConfig({ realmName: config.get('keycloak.realm') });
            this.authenticated = true;
        } catch (e) {
            throw new AuthException(e.message || 'Unable to authenticate. Unknown error ocurred.');
        }
    }

    /**
     * Get KeycloakClient interface
     */
    async getAPI(): Promise<KeycloakClient> {
        if (!this.authenticated) {
            await this.auth();
        }

        return this.keyCloakAdminClient;
    }
}
