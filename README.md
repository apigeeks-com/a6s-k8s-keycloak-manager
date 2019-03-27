# a6s-k8s-keycloak-manager

Keycloak management service based on K8s custom resource definitions

## Aim
  Setup all necessary Keycloak entities in scope of k8s applications deployment configuration.

## Install
```bash
git clone https://github.com/apigeeks-com/a6s-k8s-keycloak-manager.git
cd a6s-k8s-keycloak-manager
helm install --name keycloak-manager ./helm/keycloak-manager
```

## "KeycloakClient" Resource Format

```yaml
apiVersion: "apigeeks.com/v1"
kind: KeycloakClient
metadata:
  name: client-name
spec:
  # [required] 
  clientId: some-client
  # ... other client specific fields (https://www.keycloak.org/docs-api/5.0/rest-api/index.html#_clientrepresentation)
  
  # [optional] array of realm level roles (https://www.keycloak.org/docs-api/5.0/rest-api/index.html#_roles_resource)
  realmRoles: []
  
  # [optional] array of client level roles (https://www.keycloak.org/docs-api/5.0/rest-api/index.html#_roles_resource)
  clientRoles: [] 

  # [optional] array of realm level role mappers (https://www.keycloak.org/docs-api/5.0/rest-api/index.html#_role_mapper_resource)
  realmRoleMappers: []

  # [optional] array of client roles mappers (https://www.keycloak.org/docs-api/5.0/rest-api/index.html#_role_mapper_resource)
  clientRoleMappers:  []

  # [optional] array of Keycloak groups (https://www.keycloak.org/docs-api/5.0/rest-api/index.html#_groups_resource)
  associatedGroups: []
  
  # [optional] array of Keycloak users (https://www.keycloak.org/docs-api/5.0/rest-api/index.html#_users_resource)
  associatedUsers: []
  
  # [optional] array of client scopes (https://www.keycloak.org/docs-api/5.0/rest-api/index.html#_client_scopes_resource)
  clientScopes: []
  
  # [optional] array of realm level scopes (https://www.keycloak.org/docs-api/5.0/rest-api/index.html#_scope_mappings_resource)
  scopeRealmMappers: []
```

## Example

```yaml
apiVersion: "apigeeks.com/v1"
kind: KeycloakClient
metadata:
  name: client-name
spec:
  clientId: client-name
  surrogateAuthRequired: false
  enabled: true
  clientAuthenticatorType: client-secret
  secret: a9609ee1-675a-4516-8b91-49a0c7845e3a
  redirectUris:
    - "https://service.host.com/*"
  webOrigins:
    - service.host.com
  notBefore: 0
  bearerOnly: false
  consentRequired: false
  standardFlowEnabled: true
  implicitFlowEnabled: false
  directAccessGrantsEnabled: true
  serviceAccountsEnabled: true
  authorizationServicesEnabled: true
  publicClient: false
  frontchannelLogout: false
  protocol: openid-connect
  attributes:
    saml.assertion.signature: 'false'
    saml.force.post.binding: 'false'
    saml.multivalued.roles: 'false'
    saml.encrypt: 'false'
    saml.server.signature: 'false'
    saml.server.signature.keyinfo.ext: 'false'
    exclude.session.state.from.auth.response: 'false'
    saml_force_name_id_format: 'false'
    saml.client.signature: 'false'
    tls.client.certificate.bound.access.tokens: 'false'
    saml.authnstatement: 'false'
    display.on.consent.screen: 'false'
    saml.onetimeuse.condition: 'false'
  authenticationFlowBindingOverrides: {}
  fullScopeAllowed: true
  nodeReRegistrationTimeout: -1
  
  protocolMappers:
    - name: Client ID
      protocol: openid-connect
      protocolMapper: oidc-usersessionmodel-note-mapper
      consentRequired: false
      config:
        user.session.note: clientId
        id.token.claim: 'true'
        access.token.claim: 'true'
        claim.name: clientId
        jsonType.label: String
    - name: Client IP Address
      protocol: openid-connect
      protocolMapper: oidc-usersessionmodel-note-mapper
      consentRequired: false
      config:
        user.session.note: clientAddress
        id.token.claim: 'true'
        access.token.claim: 'true'
        claim.name: clientAddress
        jsonType.label: String
    - name: Client Host
      protocol: openid-connect
      protocolMapper: oidc-usersessionmodel-note-mapper
      consentRequired: false
      config:
        user.session.note: clientHost
        id.token.claim: 'true'
        access.token.claim: 'true'
        claim.name: clientHost
        jsonType.label: String
  defaultClientScopes:
    - gatekeeper
  
  optionalClientScopes:
    - address
  
  authorizationSettings:
    allowRemoteResourceManagement: true
    policyEnforcementMode: ENFORCING
    resources:
      - name: Default Resource
        type: resources:default
        ownerManagedAccess: false
        attributes: {}
        uris:
          - "/*"
    policies:
      - name: Default Policy
        description: A policy that grants access only for users within this realm
        type: js
        logic: POSITIVE
        decisionStrategy: AFFIRMATIVE
        config:
          code: |
            // by default, grants any permission associated with this policy
            $evaluation.grant();
      - name: Default Permission
        description: A permission that applies to the default resource type
        type: resource
        logic: POSITIVE
        decisionStrategy: UNANIMOUS
        config:
          defaultResourceType: resources:default
          applyPolicies: '["Default Policy"]'
    scopes: []

  # Realm-level roles are a global namespace to define your roles.
  realmRoles:
  - name: realm-role1
  - name: realm-role2
  
  # Client roles are basically a namespace dedicated to a client
  clientRoles:
  - name: client-role1
  - name: client-role2
  - name: client-role3
    clientRole: true
    composite: true
    composites:
      client:
        realm-management:
          - view-clients
          - view-users

  # Scope realm roles
  scopeRealmMappers:
  - "realm-role1"

  # Mappers realm roles
  realmRoleMappers:
  - "realm-role2"

  # Mappers client roles
  clientRoleMappers:
  - 'client-role3'
  
  # Associated groups
  associatedGroups:
  - name: client-group1
    path: "/client-group1"
    attributes: {}
    realmRoles: []
    clientRoles:
      client-name:
        - client-role1
    subGroups: []

  - name: client-group2
    path: "/client-group2"
    attributes: {}
    realmRoles: []
    clientRoles:
      client-name:
        - client-role2
    subGroups: []

  - name: client-group3
    path: "/client-group3"
    attributes: {}
    realmRoles: []
    clientRoles:
      client-name:
        - client-role3
    subGroups: []

  # Associated users
  associatedUsers:
  - username: user1
    enabled: true
    password: user1
    email: foo@boo.com
    firstName: user1
    lastName: user1
    clientRoles:
      client-name:
      - client-role1
      - client-role2
    groups:
      - client-group1

  - username: user2
    enabled: true
    password: user2
    email: boo@foo.com
    firstName: user2
    lastName: user2
    groups:
      - client-group2
      
  # Client scope is a way to limit the roles that get declared inside an access token
  clientScopes:
  - name: gatekeeper
    realmRoles:
    - admin
    protocol: openid-connect
    attributes:
      include.in.token.scope: 'true'
      display.on.consent.screen: 'true'
    protocolMappers:
      - name: ftpo
        protocol: openid-connect
        protocolMapper: oidc-audience-mapper
        consentRequired: false
        config:
          included.client.audience: gatekeeper
          id.token.claim: 'false'
          access.token.claim: 'true'
```
