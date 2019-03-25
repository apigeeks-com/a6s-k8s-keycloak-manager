import { ConnectionConfig, KeycloakAdminClient } from 'keycloak-admin/lib/client';
import { ClientScope, ClientScopeMappings, ClientRoleComposite } from './Resource';

export class KeycloakClient extends KeycloakAdminClient {
    public clientScope: ClientScope;
    public clientScopeMappings: ClientScopeMappings;
    public clientRoleComposite: ClientRoleComposite;

    constructor(connectionConfig?: ConnectionConfig) {
        super(connectionConfig);

        this.clientScope = new ClientScope(this);
        this.clientScopeMappings = new ClientScopeMappings(this);
        this.clientRoleComposite = new ClientRoleComposite(this);
    }
}
