import * as prettyjson from 'prettyjson';
import { Inject, Service } from 'typedi';
import { Logger } from 'log4js';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import { RoleMappingPayload } from 'keycloak-admin/lib/defs/roleRepresentation';
import UserRepresentation from 'keycloak-admin/lib/defs/userRepresentation';
import { InjectLogger } from '../decorator';
import { KeycloakAdminService } from './KeycloakAdminService';

@Service()
export class RealmRoleMappersService {
    @Inject()
    private keycloakAdmin!: KeycloakAdminService;

    @InjectLogger('services/RealmRoleMappersService')
    private logger!: Logger;

    async mapping(roles: string[], client: ClientRepresentation): Promise<void> {
        this.logger.debug(`Realm mapping roles: \n${prettyjson.render(roles)}`);

        if (!client.id) {
            throw new Error('Client id property cannot be undefined');
        }

        const serviceAccount = (await this.keycloakAdmin.api.clients.getServiceAccountUser({
            id: client.id,
        })) as UserRepresentation & { id: string };

        if (!serviceAccount) {
            throw new Error(`Service account for client: ${client.clientId} not found`);
        }

        await Promise.all(
            roles.map(async role => {
                const foundRole = await this.keycloakAdmin.api.roles.findOneByName({ name: role });

                if (foundRole) {
                    return await this.keycloakAdmin.api.users.addRealmRoleMappings({
                        id: serviceAccount.id,
                        roles: [foundRole as RoleMappingPayload],
                    });
                }

                this.logger.error(`Realm role ${role} not found`);

                return Promise.resolve();
            }),
        );
    }
}
