import React, {useState} from "react";``
import {Link} from "react-router-dom"
import JoinRoomInfo from "../JoinRoom";

export default function Main() {
    const [roomNo, setRoomNo] = useState("");
    const [username, setUsername] = useState("");

    const onClickHandler = () => {
        console.log(roomNo)

        if (roomNo === "" || username === "") {
            alert("방 번호 또는 이름이 입력되지 않았습니다.");
            return;
        }
    }
    const joinRoomInfo: JoinRoomInfo = {
        roomNo: roomNo,
        username: username,
    }

    const roomNoOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRoomNo(e.target.value);
    };
    const userNameOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUsername(e.target.value);
    };

    return (
        <div style={{textAlign: "center", paddingTop: 40}}>
            <h3>방 번호를 입력해주세용.</h3>
            <input type="text" onChange={roomNoOnChange} placeholder="방 번호" />
            <input type="text" onChange={userNameOnChange} placeholder="이름" />
            <Link to='/room' state={{joinRoomInfo}}>
                <button style={{marginLeft: 10}} onClick={onClickHandler}>확인</button>
            </Link>
        </div>
    );
}