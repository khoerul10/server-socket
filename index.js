require('dotenv').config();
const fs = require('fs').promises;
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const https = require('https');
const socketIO = require('socket.io');

const app = express();
const port = process.env.PORT || 40;

const notificationSecret = process.env.NOTIFICATION_SECRET || 'NOTIFICATION_SECRET';
const notificationKey = process.env.NOTIFICATION_KEY || 'NOTIFICATION_KEY';
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
    path: `${process.env.PATH_CONNECT}`,
    cors: {
        origin: '*'
    }
});

server.listen(port, () => console.log('Server listening at port', port));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// app.post(`/ws/dashboard/send`, (req, res) => {
app.post(`${process.env.PATH_POST}/send`, (req, res) => {
    const data = req.body;

    if (!req.headers || req.headers.notification_secret !== notificationSecret) {
        return res.status(401).json({ code: 401, message: 'Invalid notification secret' });
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

        console.log('Notification:', data.notification, 'sent to channels:', data.channel);
        return res.status(200).json({ code: 200, message: 'Notification sent successfully' });
    }

    return res.status(400).json({ code: 400, message: 'Missing parameters' });
});

// io.on('connection', (socket) => {
//     const { query } = socket.handshake;

//     if (!validateConnection(query)) {
//         return;
//     }

//     socket.on('join', (channel) => {
//         socket.join(channel);
//     });

//     socket.on('leave', (channel) => {
//         socket.leave(channel);
//     });
// });

io.on('connection', (socket) => {
    const { query } = socket.handshake;

    try {
        if (!validateConnection(query)) {
            return;
        }
    } catch (err) {
        console.error('Error validating connection:', err);
        socket.disconnect(true);
        return;
    }

    socket.on('join', (channel) => {
        try {
            socket.join(channel);
        } catch (err) {
            console.error('Error joining channel:', err);
        }
    });

    socket.on('leave', (channel) => {
        try {
            socket.leave(channel);
        } catch (err) {
            console.error('Error leaving channel:', err);
        }
    });
});


function validateConnection(query) {
    return query.notificationKey === notificationKey;
}
