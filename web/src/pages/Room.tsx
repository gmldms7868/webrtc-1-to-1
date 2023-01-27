import React, {useEffect, useRef, useState} from "react";
import {Link, useLocation} from "react-router-dom";
import io, {Socket} from "socket.io-client";
import JoinRoomInfo from "../JoinRoom";
import Loading from "./Loading";

const SERVER_URL = "http://3.36.68.140:3002";

export default function Room(): React.ReactElement {
    const location = useLocation();
    const joinRoomInfo = location.state.joinRoomInfo;
    const [isLoading, setIsLoading] = useState(false);

    const socketRef = useRef<Socket>();                                  // PTCPeerConnection
    const rtcPeerConnectRef = useRef<RTCPeerConnection>();               // Signaling Server 와 통신할 Socket

    const localVideoRef = useRef<HTMLVideoElement>(null);      // 본인의 video, audio 를 재생할 video 태그의 ref
    const remoteVideoRef = useRef<HTMLVideoElement>(null);     // 상대방의 video, audio 를 재생할 video 태그의 ref

    const pc_config = {iceServers: [{urls: "stun:stun.l.google.com:19302",}]}    // PTCPeerConnection 을 생성할 때의 config

    console.log(`Room client joinRoomInfo: ${joinRoomInfo.roomNo}`);
    console.log(`Room client joinRoomInfo: ${joinRoomInfo.username}`);

    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    const setVideoTracks = async () => {
        await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        }).then((stream) => {
            setIsLoading(true);
            /* use the stream */
            if (localVideoRef.current) localVideoRef.current.srcObject = stream
            if (!(rtcPeerConnectRef.current && socketRef.current)) return;

            // 본인의 video, audio track 을 모두 자신의 RTCPeerConnection 에 등록한다.
            stream.getTracks().forEach((track) => {
                if (!rtcPeerConnectRef.current) return;
                rtcPeerConnectRef.current.addTrack(track, stream);
            });

            // onIcecandidate
            // offer or answer signal 을 생성한 후부터 본인의 icecandidate 정보가 발생한다.
            // offer or answer signal 을 보냈던 상대방에게 본인의 icecandidate 정보를 signaling server 를 통해 보낸다.
            rtcPeerConnectRef.current!.onicecandidate = (e) => {
                if (e.candidate) {
                    if (!socketRef.current) return;
                    console.log('onicecandidate');
                    socketRef.current.emit('candidate', e.candidate);
                }
            };

            // onIceConnectionStateChange
            // ICE connection 상태가 변경됐을 때의 log
            rtcPeerConnectRef.current!.oniceconnectionstatechange = (e) => {
                console.log(`ICEConnect State: ${e}`);
            };

            // onTrack
            // 상대방의 RTCSessionDescription 을 본인의 RTCPeerConnection 에서의 remoteSessionDescription 으로 지정하면
            // 상대항의 track 데이터에 대한 이벤트가 발생한다.
            // 해당 데이터에서 MediaStream 을 상대방의 video, audio 를 재생할 video 태그에 등록한다.
            rtcPeerConnectRef.current!.ontrack = (ev) => {
                console.log('add remote track success');
                if (remoteVideoRef.current) {
                    console.log(`ev.streams[] ${ev.streams[0].getTracks()}`)
                    remoteVideoRef.current.srcObject = ev.streams[0];
                }
            };

            // 본인의 video, audio track 을 모두 자신의 RTCPeerConnection 에 등록 한 후에
            // room 에 접속 하였다고 Signal server 에 알린다.
            // 왜냐하면 순서를 어기면 offer or answer 을 주고받을 때 RTCPeerConnection 에 video, audio track 에 대한 정보가 담겨있기에
            // 순서를 어기면 상대방의 MediaStream 을 받을 수 없음.
            socketRef.current!.emit('join_room', joinRoomInfo);
            setIsLoading(false);
            // socketRef.current?.on('room_full', (message) => {
            //     console.log(">>>>>>>>>>>>")
            //     console.log(message);
            //
            // });

        }).catch((e) => {
            /* handle the error */
            console.log(`getUserMedia error: ${e}`);
        });
    }


    // ===================

    useEffect(() => {
        socketRef.current = io(SERVER_URL);
        rtcPeerConnectRef.current = new RTCPeerConnection(pc_config);

        // thisRoomUser
        // 본인을 제외한 room 안에 있는 user 정보를 받아서 offer signal 를 보낸다
        // createOffer() 함수 호출
        socketRef.current.on('thisRoomUser', (joinRoomInfo: JoinRoomInfo) => {
            if (joinRoomInfo != null) {
                createOffer().then(() => console.log(`socket on thisRoomUser createOffer()`));
            }
        });

        // getOffer
        // 상대방에서 offer signal 데이터로 상대방의 RTCSessionDescription 을 받는다.
        // 해당 user 에게 answer signal 을 보낸다.
        // createAnswer(sdp) 함수 호출
        socketRef.current.on('getOffer', (sdp: RTCSessionDescription) => {
            console.log('>>>>>>> getOffer');
            createAnswer(sdp).then(() => console.log(`socket on getOffer createAnswer()`));
        });

        // getAnswer
        // 본인 RTCPeerConnection 의 RemoteDescription 으로 상대방의 RTCSessionDescription 을 설정한다.
        socketRef.current.on('getAnswer', (sdp: RTCSessionDescription) => {
            console.log(`getAnswer sdp: ${sdp}`);
            if (!rtcPeerConnectRef.current) return;
            rtcPeerConnectRef.current!.setRemoteDescription(new RTCSessionDescription(sdp)).then(() => console.log('getAnswer success.'));
        });

        // getCandidate
        // 본인 RTCPeerConnection 의 IceCandidate 로 상대방의 RTCIceCandidate 를 설정한다.
        socketRef.current.on('getCandidate', (candidate: RTCIceCandidate) => {
            if (!rtcPeerConnectRef.current) return;
            rtcPeerConnectRef.current.addIceCandidate(new RTCIceCandidate(candidate)).then(() => console.log('candidate add success'));
        });

        socketRef.current?.on('room_full', (message) => {
            console.log(">>>>>>>>>>>>")
            console.log(message);
            alert(message);
        });

        setVideoTracks().then(() => {
            console.log('setVideoTracks ...')

        }).catch(reason => console.log("아 안되는 이유가 뭐야"));


        // socketRef.current!.on('user_exit', socketId => {
        //     alert(`사용자가 나감, socketId: ${socketId.va}`)
        // })

        // return () => {
        //     if (socketRef.current) socketRef.current!.disconnect();
        //     if (rtcPeerConnectRef.current) rtcPeerConnectRef.current!.close();
        // }
    }, []);

    // 상대방에게 offer signal 전달
    const createOffer = async () => {
        if (!(rtcPeerConnectRef.current && socketRef.current)) return;

        await rtcPeerConnectRef.current!
            .createOffer({
                offerToReceiveVideo: true,
                offerToReceiveAudio: true,
            })
            .then(sdp => {
                console.log('create offer');
                rtcPeerConnectRef.current!.setLocalDescription(new RTCSessionDescription(sdp));
                socketRef.current!.emit('offer', sdp);
            })
            .catch(reason => console.log(`create offer error ... ${reason}`));
    };

    // 상대방에게 answer signal 전달
    const createAnswer = async (sdp: RTCSessionDescription) => {
        if (!(rtcPeerConnectRef.current && socketRef.current)) return;

        await rtcPeerConnectRef.current!.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log(`answer set remote description success`);

        await rtcPeerConnectRef.current!
            .createAnswer({
                offerToReceiveVideo: true,
                offerToReceiveAudio: true,
            })
            .then(mySdp => {
                console.log(`create answer`);
                rtcPeerConnectRef.current!.setLocalDescription(new RTCSessionDescription(mySdp));
                socketRef.current!.emit('answer', mySdp);
            })
            .catch(reason => console.log(`create answer error ... ${reason}`));
    }

    const onClickHandler = () => {
        socketRef.current!.emit('delete_user', joinRoomInfo);

        socketRef.current!.on('user_exit', () => {
            alert(`${joinRoomInfo.username} 이 나감`);
        });

        if (socketRef.current) {
            socketRef.current.disconnect();
        }
        if (rtcPeerConnectRef.current) {
            rtcPeerConnectRef.current.close();
        }
    }

    return isLoading ? <Loading /> : (
        <div style={{textAlign: "center"}}>
            <Link to={"/"}>
                <button style={{width: '30'}} onClick={onClickHandler}>나가기</button>
            </Link>
            <h2>roomNo: {joinRoomInfo.roomNo}</h2>
            <h2>username: {joinRoomInfo.username}</h2>
            <video style={{width: 800, height: 800, margin: 5, backgroundColor: "black"}} ref={remoteVideoRef} autoPlay={true}/>
            <video style={{width: 300, height: 300, margin: 5, backgroundColor: "red"}} ref={localVideoRef} autoPlay={true}/>
        </div>
    );
}