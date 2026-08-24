import { createSlice } from '@reduxjs/toolkit';

const userSlice = createSlice({
    name: 'user',
    initialState: {
        userData: null,
        authLoading: true,
    },
    reducers: {
        setUserData: (state, action) => {
            state.userData = action.payload;
            state.authLoading = false;
        },
        setAuthLoading: (state, action) => {
            state.authLoading = action.payload;
        },
    }
});

export const { setUserData, setAuthLoading } = userSlice.actions;
export default userSlice.reducer;