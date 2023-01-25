import React from "react";
import {Route, Routes} from "react-router-dom";
import Room from "./pages/Room";
import Main from "./pages/Main";
import Header from "./components/Header";

export default function App() {
    return (
        <div>
            <Header />
                <Routes>
                    <Route path="/" element={<Main />}></Route>
                    <Route path="/room" element={<Room />}></Route>
                </Routes>
        </div>
    );
}
