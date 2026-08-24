import React, { useEffect } from "react";
import LangingPage from "./pages/Landing/landing.jsx";
import { getCurrentuser } from "./features/getCurrentUser.js";
import { useDispatch } from "react-redux";
import { setUserData } from "./redux/userSlice.js";

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    let isMounted = true;
    const getUser = async () => {
      try {
        const data = await getCurrentuser();
        if (isMounted) {
          dispatch(setUserData(data));
        }
      } catch (error) {
        if (isMounted) {
          dispatch(setUserData(null));
        }
      }
    };
    getUser();
    return () => {
      isMounted = false;
    };
  }, [dispatch]);
  return (
    <>
      <LangingPage />
    </>
  );
}
