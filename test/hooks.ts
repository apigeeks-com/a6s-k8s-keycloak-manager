import 'reflect-metadata';

process.on('unhandledRejection', (reason, p) => {
    console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
    process.exit(1);
});
