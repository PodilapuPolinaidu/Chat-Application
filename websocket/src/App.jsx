import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Register from "./pages/Register/Register.jsx";
import Login from "./pages/Login/Login.jsx";
import Chat from "./components/Chat/Chat.jsx";
import "bootstrap-icons/font/bootstrap-icons.css";
const App = () => {
  return (
    <div>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={<Chat />} />
          <Route path="*" element={<Register />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};

export default App;
