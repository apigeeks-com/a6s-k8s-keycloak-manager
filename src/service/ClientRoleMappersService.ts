import * as prettyjson from 'prettyjson';
import { Logger } from 'log4js';
import { Inject, Service } from 'typedi';
import RoleRepresentation from 'keycloak-admin/lib/defs/roleRepresentation';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import UserRepresentation from 'keycloak-admin/lib/defs/userRepresentation';
import { InjectLogger } from '../decorator';
import { KeycloakAdminService } from './KeycloakAdminService';

@Service()
export class ClientRoleMappersService {
    @Inject()
    private keycloakAdmin!: KeycloakAdminService;

    @InjectLogger('services/ClientRoleMappersService')
    private logger!: Logger;

    async mapping(roles: string[], client: ClientRepresentation): Promise<void> {
        this.logger.debug(`Client mapping roles: \n${prettyjson.render(roles)}`);

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
                const listRoles: RoleRepresentation[] = await this.keycloakAdmin.api.clients.listRoles({
                    id: (client as any).id,
                });
                const foundRole = listRoles.filter(r => r.name === role);

                if (serviceAccount && serviceAccount.id && foundRole.length) {
                    return await this.keycloakAdmin.api.users.addClientRoleMappings({
                        id: serviceAccount.id,
                        clientUniqueId: (client as any).id,
                        roles: foundRole as any,
                    });
                }

                this.logger.error(`Client role ${role} not found`);

                return Promise.resolve();
            }),
        );
    }
}
