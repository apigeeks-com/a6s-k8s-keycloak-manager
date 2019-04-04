import * as prettyjson from 'prettyjson';
import { Inject, Service } from 'typedi';
import { Logger } from 'log4js';
import { InjectLogger } from '../decorator';
import { IKeycloakScope } from '../interface';
import { RolesService } from './RolesService';
import { KeycloakClient } from '../KeycloakClient';

@Service()
export class ClientScopeService {
    @Inject()
    private rolesService!: RolesService;

    @InjectLogger('services/ClientScopeService')
    private logger!: Logger;

    async create(keycloakClient: KeycloakClient, scope: IKeycloakScope) {
        this.logger.debug(`Create client scope: \n${prettyjson.render(scope)}`);
        await keycloakClient.clientScope.create(scope);
    }

    async update(keycloakClient: KeycloakClient, id: string, scope: IKeycloakScope) {
        this.logger.debug(`Update group: \n${prettyjson.render(scope)}`);
        await keycloakClient.clientScope.update({ id }, scope);
    }

    async updateOrCreate(keycloakClient: KeycloakClient, clientScopes: IKeycloakScope[]) {
        this.logger.debug(`Create or update client scopes: \n${prettyjson.render(clientScopes)}`);

        await Promise.all(
            clientScopes.map(async scope => {
                let foundClientScope: any = await this.findOne(keycloakClient, (scope as any).name);

                if (foundClientScope) {
                    await this.update(keycloakClient, foundClientScope.id, scope);
                } else {
                    await this.create(keycloakClient, scope);
                    foundClientScope = await this.findOne(keycloakClient, (scope as any).name);
                }

                if (foundClientScope && scope.realmRoles) {
                    const roles = await this.rolesService.findRealmRoles(keycloakClient, scope.realmRoles);

                    if (roles.length) {
                        await keycloakClient.clientScope.realmRoleMappings({
                            id: foundClientScope.id,
                            roles,
                        });
                    }
                }
            }),
        );
    }

    private async findOne(keycloakClient: KeycloakClient, name: string) {
        this.logger.debug(`Find client scope by name: ${name}`);

        const list = await keycloakClient.clientScope.find();

        if (list) {
            const scope = list.find(g => g.name === name);

            if (scope) {
                this.logger.debug(`Client scope found: \n${prettyjson.render(scope)}`);

                return scope;
            }
        }
    }
}
