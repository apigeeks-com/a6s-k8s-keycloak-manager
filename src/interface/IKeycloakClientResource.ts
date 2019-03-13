import { IKeycloakClientResourceMetadata } from './IKeycloakClientResourceMetadata';
import { IKeycloakClientResourceSpec } from './IKeycloakClientResourceSpec';

export interface IKeycloakClientResource {
    apiVersion: string;
    metadata: IKeycloakClientResourceMetadata;
    spec: IKeycloakClientResourceSpec;
}
