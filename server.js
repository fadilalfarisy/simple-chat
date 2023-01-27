import express from 'express'
import bodyParser from 'body-parser'
import { createServer } from 'http'
import { Server } from 'socket.io'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { formatMessage } from './src/utils/message.js'
import {
    getRoomUser,
    userJoin,
    findUser,
    editUser,
    removeUser
} from './src/controller/userController.js'

dotenv.config()

//config __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

//set bodyparser
app.use(bodyParser.urlencoded({ extended: false }))

//set public folder
app.use(express.static('public'))

app.get('/', async (req, res) => {
    res.sendFile(__dirname + '/index.html')
})

//run when client connect
io.on('connection', (socket) => {

    //GLOBAL ROOM 
    socket.on('init', (username) => {

        //insert data user to variable
        userJoin(socket.id, username, '/')

        //get data user by id
        const user = findUser(socket.id)

        //join global room
        socket.join(user.room);

        //say hi from admin to user when join chat
        socket.emit('message', formatMessage('ADMIN', `WELCOME TO GLOBAL ROOM ${user.username}`));

        //broadcast all the users in the same room 
        socket.broadcast
            .to(user.room)
            .emit('message', formatMessage('ADMIN', `${user.username} HAS JOIN TO GLOBAL ROOM`));

        //send data online user to everyone with the same room
        io.to(user.room).emit('listUser', ({
            users: getRoomUser(user.room)
        }))
    })


    //PRIVATE ROOM
    socket.on('join', (room) => {

        //get old data user
        const oldUser = findUser(socket.id)

        //leave old room
        socket.leave(oldUser.room);

        //send message user left global user
        socket
            .to(oldUser.room)
            .emit('message', formatMessage('ADMIN', `${oldUser.username} HAS LEFT FROM GLOBAL ROOM`));

        //edit room user
        const user = editUser(socket.id, room);

        //join new room
        socket.join(user.room);

        //say hi from admin when user join chat
        socket.emit('message', formatMessage('ADMIN', `WELCOME TO ROOM ${user.room} ${user.username}`));

        //broadcast all the users in the same room 
        socket.broadcast
            .to(user.room)
            .emit('message', formatMessage('ADMIN', `${user.username} HAS JOIN TO ROOM ${user.room}`,));

        //send data online user to everyone with the same room
        io.to(user.room).emit('listUser', ({
            users: getRoomUser(user.room)
        }))
    })

    //broadcast chat message
    socket.on('chatMessage', (chatMessage) => {
        const user = findUser(socket.id)
        io.to(user.room).emit('message', formatMessage(user.username, chatMessage))
    })

    //when user disconnect
    socket.on('disconnect', () => {
        const user = findUser(socket.id)

        if (user) {
            //send other user when someone disconnect
            socket.broadcast
                .to(user.room)
                .emit('message', formatMessage('ADMIN', `${user.username} HAS LEFT`))

            //remove user when disconnect
            removeUser(socket.id)

            //update list online user
            io.to(user.room).emit('listUser', ({
                users: getRoomUser(user.room)
            }))
        }

    })
})

//set PORT
const PORT = process.env.PORT || 3000

//listen server running
httpServer.listen(PORT, () => console.log(`server running on port ${PORT}`));

