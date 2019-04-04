import * as prettyjson from 'prettyjson';
import { Logger } from 'log4js';
import { Inject, Service } from 'typedi';
import RoleRepresentation from 'keycloak-admin/lib/defs/roleRepresentation';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import UserRepresentation from 'keycloak-admin/lib/defs/userRepresentation';
import { InjectLogger } from '../decorator';
import { config } from '../utils/config';
import { KeycloakClient } from '../KeycloakClient';

@Service()
export class ClientRoleMappersService {
    @InjectLogger('services/ClientRoleMappersService')
    private logger!: Logger;

    async mapping(keycloakClient: KeycloakClient, roles: string[], client: ClientRepresentation): Promise<void> {
        this.logger.debug(`Client mapping roles: \n${prettyjson.render(roles)}`);

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
                const listRoles: RoleRepresentation[] = await keycloakClient.clients.listRoles({
                    id: (client as any).id,
                    realm: config.get('keycloak.realm'),
                });
                const foundRole = listRoles.filter(r => r.name === role);

                if (serviceAccount && serviceAccount.id && foundRole.length) {
                    return await keycloakClient.users.addClientRoleMappings({
                        id: serviceAccount.id,
                        clientUniqueId: (client as any).id,
                        roles: foundRole as any,
                        realm: config.get('keycloak.realm'),
                    });
                }

                this.logger.error(`Client role ${role} not found`);

                return Promise.resolve();
            }),
        );
    }
}
