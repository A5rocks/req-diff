import { createServer, request } from 'http';
import { diff } from 'just-diff';

type Server = {
    host: string,
    port: number,
};

function parseServer(input: string) {
    if (Number(input)) {
        return {
            host: 'localhost',
            port: Number(input),
        };
    } else if (input.includes(':')) {
        // <host, can contain : > : <port>
        const parts = input.split(':');
        const port = Number(parts.pop());
        if (!port) return null;

        return {
            host: parts.join(':'),
            port: port,
        };
    } else {
        return null;
    }
}

function outputServer(input: Server) {
    return `${input.host}:${input.port}`;
}

function logDifference(serv: Server, path: string, difference: any[]) {
    console.warn(outputServer(serv), path, difference);
}

const serverPort = Number(process.argv[2]);

if (!serverPort) {
    console.error('The first argument should be the port to listen on');
    process.exit(1);
}

const httpServer = createServer().listen(serverPort);
const [ original, ...others ] = process.argv.slice(3).map(parseServer);

httpServer.on('request', (req, res) => {
    let originalResponse: Promise<any> = new Promise((result) => {
        const connection = request({
            host: original.host,
            port: original.port,
            path: req.url,
            method: req.method,
            headers: req.headers,
        }, (resp) => {
            resp.pipe(res);

            let data = [];
            resp.on('data', (chunk) => data.push(chunk));
            resp.on('end', () => {
                // TODO: should this... not assume JSON?
                result(JSON.parse(data.join('')));
            });
        });
    
        req.pipe(connection);
    });

    for (const other of others) {
        const conn = request({
            host: other.host,
            port: other.port,
            path: req.url,
            method: req.method,
            headers: req.headers,
        }, (resp) => {
            let data = [];
            resp.on('data', (chunk) => data.push(chunk));
            resp.on('end', async () => {
                const difference = diff(await originalResponse, JSON.parse(data.join('')));

                if (difference.length > 0) {
                    logDifference(other, req.url, difference);
                };
            });
        });

        req.pipe(conn);
    };
});

httpServer.on('listening', () => {
    console.log(`server started on port ${serverPort}`);
});
