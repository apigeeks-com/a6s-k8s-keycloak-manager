import * as prettyjson from 'prettyjson';
import { Inject, Service } from 'typedi';
import { Logger } from 'log4js';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import { RoleMappingPayload } from 'keycloak-admin/lib/defs/roleRepresentation';
import UserRepresentation from 'keycloak-admin/lib/defs/userRepresentation';
import { InjectLogger } from '../decorator';
import { config } from '../utils/config';
import { KeycloakClient } from '../KeycloakClient';

@Service()
export class RealmRoleMappersService {
    @InjectLogger('services/RealmRoleMappersService')
    private logger!: Logger;

    async mapping(keycloakClient: KeycloakClient, roles: string[], client: ClientRepresentation): Promise<void> {
        this.logger.debug(`Realm mapping roles: \n${prettyjson.render(roles)}`);

        if (!client.id) {
            throw new Error('Client id property cannot be undefined');
        }

        const serviceAccount = (await keycloakClient.clients.getServiceAccountUser({
            id: client.id,
            realm: config.get('keycloak.realm'),
        })) as UserRepresentation & { id: string };

        if (!serviceAccount) {
            throw new Error(`Service account for client: ${client.clientId} not found`);
        }

        await Promise.all(
            roles.map(async role => {
                const foundRole = await keycloakClient.roles.findOneByName({
                    name: role,
                    realm: config.get('keycloak.realm'),
                });

                if (foundRole) {
                    return await keycloakClient.users.addRealmRoleMappings({
                        id: serviceAccount.id,
                        roles: [foundRole as RoleMappingPayload],
                        realm: config.get('keycloak.realm'),
                    });
                }

                this.logger.error(`Realm role ${role} not found`);

                return Promise.resolve();
            }),
        );
    }
}
