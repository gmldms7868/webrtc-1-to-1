
const express = require('express');
const app = express();
const http = require('http');
const https = require('https');
const httpServer = http.createServer(app);
const {Server} = require("socket.io");
const fs =  require('fs');

const option = {
    key: fs.readFileSync('fake-keys/key.pem'),
    cert: fs.readFileSync('fake-keys/cert.pem')
}
const httpsServer = https.createServer(option, app);

// const io = new Server(httpServer, {
//     cors: {
//         origin: "*",
//         methods: ["GET", "POST"]
//     }
// });

const io = new Server(httpsServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})
console.log(io.path());

const HTTP_PORT = 3002;
const HTTPS_PORT = 443;

let roomUsers = {
    roomNo: "",
    members: [
        // {}
        // {socketId: "", username: ""}
    ]
};

let socketToRoom = {};

io.on('error', e => console.log(`error... ${e}`))

// 연결
io.on('connection', (socket) => {   // 연결이 들어오면 실행되는 event (socket 변수에는 실행 시점에 연결한 상대화 연결된 소켓의 객체가 들어있다.)
    console.log(`connected... socket id: [ ${socket.id} ]`);

    socket.on('join_room', (data) => {

        // 생성된 users 중 해당 roomNo 가 존재하면?
        if(roomUsers.members.length !== 0) {
            // room 에 2 명 초과로 접속 시도 시
            console.log('room memebers length: '+roomUsers.members.length)
            if(roomUsers.members.length === 2) {
                console.log("여기 되면 ?")
                socket.emit('room_full', data.roomNo + 'Room No.');
                return;
            }

            // 해당 roomNo 에 user 추가
            roomUsers.members.push({
                socketId: socket.id, username: data.username
            });
            console.log(`${data.roomNo} 에 ${socket.id}, ${data.username} 추가함`)
        } else {
            // room 생성
            roomUsers.roomNo = data.roomNo;

            roomUsers.members.push({
                socketId: socket.id,
                username: data.username
            });
            console.log(`생성한거 ${roomUsers.roomNo}, ${data.username}`)
        }
        // 해당 소켓이 어느 room 에 속해있는지 알기 위해 저장
        socketToRoom[socket.id] = data.roomNo;

        socket.join(data.roomNo);
        console.log(`[${socketToRoom[socket.id]}]: ${socket.id} enter`);

        // 본인을 제외한 user
        const thisRoomUser = roomUsers.members.filter(m => m.socketId !== socket.id);

        // 본인에게 접속한 "나" 빼고 room 안에 있는 user 정보를 보냄
        // 새로 접속하는 user 가 이미 방에 있는 user 에게 offer(signal) 을 보내기 위해서
        console.log(`thisRoomUser : ${thisRoomUser.toString()}`)
        // socket.broadcast.emit("thisRoomUser", thisRoomUser);
        socket.to(data.roomNo).emit("thisRoomUser", thisRoomUser);
    });

    // 다른 user 에게 offer 를 보냄 (자신의 RTCSessionDescription)
    socket.on("offer", sdp => {
        console.log(`offer: ${socket.id}`);
        //  broadcast 를 통해 전달
        socket.to(roomUsers.roomNo).emit('getOffer', sdp);
    });

    // offer 를 보낸 user 에게 answer 를 보냄 (자신의 RTCSessionDescription)
    socket.on('answer', sdp => {
        console.log(`answer: ${socket.id}`);
        socket.to(roomUsers.roomNo).emit('getAnswer', sdp);
    });

    // 자신의 ICECandidate 정보를 signal (offer 또는 answer 을) 주고받은 상대에게 전달
    socket.on('candidate', candidate => {
        console.log(`candidate: ${socket.id}`);
        socket.to(roomUsers.roomNo).emit('getCandidate', candidate);
    });

    // 나가기 버튼 눌렀을 때
    socket.on('delete_user', joinRoomInfo => {
       console.log(joinRoomInfo.username + " 이 나감");

        if (roomUsers.members.length > 1) { // 룸에 2명 이상이면 사람 지우고
            console.log(`member length: ${roomUsers.members.length}`)
            roomUsers.members = roomUsers.members.filter(m => m.username === joinRoomInfo.username);

            // socket.broadcast.emit("user_exit");
            socket.to(roomUsers.roomNo).emit("user_exit");
            console.log(`현재 [${roomUsers.roomNo}] user: ${roomUsers.members}`);
        } else {    // 1명 있었던 상황이면 방을 없앤다.
            // roomUser 제거
            roomUsers = {
                roomNo: "",
                members: [ ]
            };
        }

    });

    // 사용자 간의 연결이 끊겼을 때
    socket.on('disconnect', () => {
        console.log(`disconnect ... socket id: ${socket.id}`)
        console.log(`[${socketToRoom[socket.id]}: ${socket.id} exit`);

        // disconnect 한 user 가 포함된 roomId
        // const roomId = socketToRoom[socket.id];
        const roomId = socketToRoom[socket.id];
        console.log(`disconnect roomId:::: ${roomId}`)

        // roomUser 에 포함된 user 정보 제거
        if (roomUsers.members.length) {
            console.log(`member length: ${roomUsers.members.length}`)
            roomUsers.members = roomUsers.members.filter(m => m.socketId === socket.id);
        } else {
            // roomUser 제거
            roomUsers = {
                roomNo: "",
                members: [ ]
            };
        }

        // 어떤 user 가 나갔는지 room 의 다른 user 에게 통보
        socket.to(roomUsers.roomNo).emit("user_exit", socketToRoom[socket.id]);
        console.log(`현재 [${roomUsers.roomNo}] user: ${roomUsers.members}`);
    });
});

httpServer.listen(HTTP_PORT, () => console.log(`server running on ${HTTP_PORT}`));
httpsServer.listen(HTTPS_PORT, () => console.log(`https servers running on ${HTTPS_PORT}`));