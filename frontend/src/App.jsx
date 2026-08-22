import React, { useEffect } from "react";
import LangingPage from "./pages/Landing/landing.jsx";
import { getCurrentuser } from "./features/getCurrentUser.js";
import { useDispatch } from "react-redux";
import { setUserData } from "./redux/userSlice.js";

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    const getUser = async () => {
      const data = await getCurrentuser();
      dispatch(setUserData(data));
    };
    getUser();
  }, []);
  return (
    <>
      <LangingPage />
    </>
  );
}
