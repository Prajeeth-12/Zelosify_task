import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/redux/features/Auth/authSlice";
import hiringReducer from "@/redux/features/Dashboard/Hiring/hiringSlice";

const store = configureStore({
  reducer: {
    auth: authReducer,
    hiring: hiringReducer,
  },
});

export default store;
