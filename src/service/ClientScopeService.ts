import * as prettyjson from 'prettyjson';
import { Inject, Service } from 'typedi';
import { Logger } from 'log4js';
import { InjectLogger } from '../decorator';
import { KeycloakAdminService } from './KeycloakAdminService';
import { IKeycloakScope } from '../interface';
import { RolesService } from './RolesService';

@Service()
export class ClientScopeService {
    @Inject()
    private keycloakAdmin!: KeycloakAdminService;

    @Inject()
    private rolesService!: RolesService;

    @InjectLogger('services/ClientScopeService')
    private logger!: Logger;

    async create(scope: IKeycloakScope) {
        this.logger.debug(`Create client scope: \n${prettyjson.render(scope)}`);
        await this.keycloakAdmin.api.clientScope.create(scope);
    }

    async update(id: string, scope: IKeycloakScope) {
        this.logger.debug(`Update group: \n${prettyjson.render(scope)}`);
        await this.keycloakAdmin.api.clientScope.update({ id }, scope);
    }

    async updateOrCreate(clientScopes: IKeycloakScope[]) {
        this.logger.debug(`Create or update client scopes: \n${prettyjson.render(clientScopes)}`);

        await Promise.all(
            clientScopes.map(async scope => {
                let foundClientScope: any = await this.findOne((scope as any).name);

                if (foundClientScope) {
                    await this.update(foundClientScope.id, scope);
                } else {
                    await this.create(scope);
                    foundClientScope = await this.findOne((scope as any).name);
                }

                if (foundClientScope && scope.realmRoles) {
                    const roles = await this.rolesService.findRealmRoles(scope.realmRoles);

                    if (roles.length) {
                        await this.keycloakAdmin.api.clientScope.realmRoleMappings({
                            id: foundClientScope.id,
                            roles,
                        });
                    }
                }
            }),
        );
    }

    private async findOne(name: string) {
        this.logger.debug(`Find client scope by name: ${name}`);

        const list = await this.keycloakAdmin.api.clientScope.find();

        if (list) {
            const scope = list.find(g => g.name === name);

            if (scope) {
                this.logger.debug(`Client scope found: \n${prettyjson.render(scope)}`);

                return scope;
            }
        }
    }
}
