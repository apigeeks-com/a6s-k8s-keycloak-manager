import { Container } from 'typedi';
import { getLogger } from 'log4js';

export function InjectLogger(category?: string): Function {
    return function(object: Object | Function, propertyName: string, index?: number) {
        Container.registerHandler({
            object,
            index,
            propertyName,
            value: () => {
                return getLogger(category);
            },
        });
    };
}
