const fs = require('fs').promises;
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const https = require('https');
const socketIO = require('socket.io');

const app = express();
const port = process.env.PORT || 4000;
const notificationSecret = 'NOTIFICATION_SECRET';
const notificationKey = 'NOTIFICATION_KEY';
const EVENTS = {
    newNotification: 'NEW_NOTIFICATION'
};

const serverOptions = {};
if (process.env.SSL_KEY && process.env.SSL_CERT) {
    try {
        serverOptions.key = fs.readFileSync(process.env.SSL_KEY);
        serverOptions.cert = fs.readFileSync(process.env.SSL_CERT);
    } catch (err) {
        console.error('Error reading SSL key/cert:', err);
        process.exit(1);
    }
}

const server = (serverOptions.key && serverOptions.cert)
    ? https.createServer(serverOptions, app)
    : http.createServer(app);

const io = socketIO(server, {
    cors: {
        origin: ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

server.listen(port, () => console.log('New Server listening at port', port));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.post('/send', (req, res) => {
    const data = req.body;

    if (!req.headers || req.headers.notification_secret !== notificationSecret) {
        return res.status(401).json('invalid notification secret');
    }

    if (data && data.notification && data.channel) {
        const dispatch = (channel, notification) => {
            io.to(channel).emit(EVENTS.newNotification, notification);
        };

        if (Array.isArray(data.channel)) {
            data.channel.forEach(channel => dispatch(channel, data.notification));
        } else {
            dispatch(data.channel, data.notification);
        }

        console.log('Notification:', data.notification, 'to channels:', data.channel);
        return res.status(200).json('ok');
    }

    return res.status(406).json('Missing parameters');
});

io.on('connection', (socket) => {
    const { query } = socket.handshake;

    if (!validateConnection(query)) {
        return;
    }

    socket.on('join', (channel) => {
        socket.join(channel);
    });

    socket.on('leave', (channel) => {
        socket.leave(channel);
    });
});

function validateConnection(query) {
    return query.notificationKey === notificationKey;
}
