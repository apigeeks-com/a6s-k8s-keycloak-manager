import { exec } from 'child_process';

export async function promiseExec(cmd: string): Promise<{ stdout: string; stderr: string }> {
    return await new Promise<{ stdout: string; stderr: string }>((res, rej) =>
        exec(cmd, (err, stdout, stderr) => {
            /* istanbul ignore next */
            if (err) {
                return rej(err);
            }

            res({
                stdout,
                stderr,
            });
        }),
    );
}
