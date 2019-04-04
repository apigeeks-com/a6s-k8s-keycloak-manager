import * as prettyjson from 'prettyjson';
import { InjectLogger } from '../decorator';
import { Inject, Service } from 'typedi';
import { Logger } from 'log4js';
import RoleRepresentation from 'keycloak-admin/lib/defs/roleRepresentation';
import ClientRepresentation from 'keycloak-admin/lib/defs/clientRepresentation';
import { config } from '../utils/config';
import { KeycloakClient } from '../KeycloakClient';

@Service()
export class RolesService {
    @InjectLogger('services/RolesService')
    private logger!: Logger;

    async findRealmRoles(keycloakClient: KeycloakClient, roles?: string[]) {
        if (roles && Array.isArray(roles) && roles.length) {
            const listRoles: RoleRepresentation[] = await keycloakClient.roles.find();

            this.logger.debug(`Mapping roles \n: ${roles}`);
            this.logger.debug(`list client roles: ${prettyjson.render(listRoles)}`);

            const mappedRoles = listRoles.filter(r => roles.indexOf((r as any).name) >= 0);
            const notFoundRoles = roles.filter(
                (r: string) => !listRoles.find(lr => lr.name === r) && !mappedRoles.find(lr => lr.name === r),
            );

            if (mappedRoles) {
                this.logger.debug(`Matched roles: \n${prettyjson.render(mappedRoles)}`);

                if (notFoundRoles.length) {
                    this.logger.warn(`Roles not found: \n${prettyjson.render(notFoundRoles)}`);
                }

                return mappedRoles;
            }

            if (notFoundRoles.length) {
                this.logger.warn(`Roles not found: \n${prettyjson.render(notFoundRoles)}`);
            }
        }

        return [];
    }

    async findClientRoles(keycloakClient: KeycloakClient, client: ClientRepresentation | any, roles: string[]) {
        this.logger.debug(`Mappings roles for client: ${client.clientId}`);

        const listRoles: RoleRepresentation[] = await keycloakClient.clients.listRoles({
            id: (client as any).id,
            realm: config.get('keycloak.realm'),
        });

        this.logger.debug(`Mapping roles \n: ${roles}`);
        this.logger.debug(`list client roles: ${prettyjson.render(listRoles)}`);

        const appendRoles = listRoles.filter((r: any) => roles.indexOf(r.name) >= 0);
        const notFoundRoles = roles.filter(
            (r: string) => !listRoles.find(lr => lr.name === r) && !appendRoles.find(lr => lr.name === r),
        );

        if (appendRoles) {
            this.logger.debug(`Matched roles: \n${prettyjson.render(appendRoles)}`);

            return appendRoles;
        }

        if (notFoundRoles.length) {
            this.logger.warn(`Roles not found: \n${prettyjson.render(notFoundRoles)}`);
        }

        return [];
    }
}
