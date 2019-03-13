import * as config from 'config';
import * as path from 'path';

if (process.env.APP_CONFIG_PATH) {
    const configPaths = process.env.APP_CONFIG_PATH.split(path.delimiter);

    if (configPaths.length) {
        for (const file of configPaths) {
            // @ts-ignore: Unreachable code error
            const configObj = config.util.parseFile(path.resolve(file));

            config.util.extendDeep(config, configObj);
        }
    }
}

export { config };
