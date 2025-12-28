import axios from "axios";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  onAuthStateChanged,
  onIdTokenChanged,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase/init";
import logger from "../utils/logger";

// Optimized Token Manager Class
class OptimizedTokenManager {
  constructor() {
    this.refreshTimeouts = new Map();
    this.isRefreshing = false;
    this.refreshPromise = null;
  }

  isTokenExpired(token) {
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const bufferTime = 5 * 60; // 5 minutes buffer

      return payload.exp <= currentTime + bufferTime;
    } catch (error) {
      console.error("Error parsing token:", error);
      return true;
    }
  }

  clearExpiredTokens() {
    const storages = [localStorage, sessionStorage];
    let hadExpiredTokens = false;

    storages.forEach((storage) => {
      const token = storage.getItem("authToken");
      if (token && this.isTokenExpired(token)) {
        storage.removeItem("authToken");
        storage.removeItem("user");
        hadExpiredTokens = true;
      }
    });

    return hadExpiredTokens;
  }

  clearAllAuthData() {
    [localStorage, sessionStorage].forEach((storage) => {
      storage.removeItem("authToken");
      storage.removeItem("user");
      storage.removeItem("redirectAfterLogin");
    });

    // Clear axios headers
    delete axios.defaults.headers.common["Authorization"];
  }

  scheduleTokenRefresh(dispatch) {
    const token =
      localStorage.getItem("authToken") || sessionStorage.getItem("authToken");

    if (!token || this.isTokenExpired(token)) return;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expiryTime = payload.exp * 1000;
      const currentTime = Date.now();
      const refreshTime = expiryTime - currentTime - 10 * 60 * 1000; // 10 minutes before expiry

      if (refreshTime > 0) {
        const timeoutId = setTimeout(() => {
          dispatch(refreshUserToken());
        }, refreshTime);

        this.refreshTimeouts.set("main", timeoutId);
      }
    } catch (error) {
      console.error("Error scheduling token refresh:", error);
    }
  }

  cleanup() {
    this.refreshTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.refreshTimeouts.clear();
    this.isRefreshing = false;
    this.refreshPromise = null;
  }
}

export const tokenManager = new OptimizedTokenManager();

// Enhanced auth initialization
export const initializeAuth = createAsyncThunk(
  "auth/initializeAuth",
  async (_, { dispatch, rejectWithValue }) => {
    try {
      logger.log("🔐 Initializing authentication...");

      // Clear any expired tokens first
      const hadExpiredTokens = tokenManager.clearExpiredTokens();

      if (hadExpiredTokens) {
        logger.log("🗑️ Expired tokens were cleared during initialization");
        return { user: null, isAuthenticated: false };
      }

      // Check for valid stored tokens
      const storedUser =
        localStorage.getItem("user") || sessionStorage.getItem("user");
      const storedToken =
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken");

      if (storedUser && storedToken) {
        try {
          const parsedUser = JSON.parse(storedUser);

          // Validate token is not expired
          if (!tokenManager.isTokenExpired(storedToken)) {
            logger.log("✅ Valid token found in storage, user authenticated");

            // Set axios header immediately
            axios.defaults.headers.common[
              "Authorization"
            ] = `Bearer ${storedToken}`;

            // Schedule refresh if needed
            tokenManager.scheduleTokenRefresh(dispatch);

            return {
              user: { ...parsedUser, token: storedToken },
              isAuthenticated: true,
            };
          } else {
            logger.log("⏰ Stored token is expired - clearing");
            tokenManager.clearAllAuthData();
          }
        } catch (parseError) {
          console.error("❌ Error parsing stored user data:", parseError);
          tokenManager.clearAllAuthData();
        }
      }

      // No valid authentication found
      logger.log("❌ No valid authentication found");
      return { user: null, isAuthenticated: false };
    } catch (error) {
      console.error("❌ Error initializing auth:", error);
      tokenManager.clearAllAuthData();
      return rejectWithValue({
        message: "Failed to initialize authentication",
        error: error.message,
      });
    }
  }
);

// Refresh user token
export const refreshUserToken = createAsyncThunk(
  "auth/refreshUserToken",
  async (_, { rejectWithValue }) => {
    try {
      if (tokenManager.isRefreshing && tokenManager.refreshPromise) {
        return tokenManager.refreshPromise;
      }

      tokenManager.isRefreshing = true;

      // Create a promise for the refresh operation and store it
      tokenManager.refreshPromise = (async () => {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser) {
            throw new Error("No authenticated user found");
          }

          const token = await currentUser.getIdToken(true);
          const expiry = Date.now() + 55 * 60 * 1000; // 55 minutes

          // Update storage
          const storage = localStorage.getItem("authToken")
            ? localStorage
            : sessionStorage;
          storage.setItem("authToken", token);

          const storedUser = storage.getItem("user");
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            userData.token = token;
            userData.tokenExpiry = expiry;
            userData.lastRefresh = new Date().toISOString();
            storage.setItem("user", JSON.stringify(userData));
          }

          // Update axios header
          axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

          tokenManager.isRefreshing = false;
          tokenManager.refreshPromise = null;
          return { token, expiry };
        } catch (error) {
          tokenManager.isRefreshing = false;
          tokenManager.refreshPromise = null;
          throw error;
        }
      })();

      return tokenManager.refreshPromise;


    } catch (error) {
      tokenManager.isRefreshing = false;
      console.error("Token refresh failed:", error);
      return rejectWithValue(error.message);
    }
  }
);

// Logout - signs out from Firebase and clears all auth data
export const performLogout = createAsyncThunk(
  "auth/performLogout",
  async (_, { dispatch: _dispatch, rejectWithValue }) => {
    try {
      logger.log("🚪 Performing logout...");

      // Sign out from Firebase
      await signOut(auth);
      logger.log("✅ Firebase sign out successful");

      // Clear all local auth data
      tokenManager.clearAllAuthData();
      tokenManager.cleanup();

      return { success: true };
    } catch (error) {
      console.error("❌ Logout error:", error);
      // Still clear local data even if Firebase signout fails
      tokenManager.clearAllAuthData();
      tokenManager.cleanup();
      return rejectWithValue(error.message);
    }
  }
);

// Auth slice with enhanced state management
const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null,
    authLoading: true, // Crucial - starts as true
    lastActivity: null,
    tokenRefreshing: false,
    initializationComplete: false, // Track initialization completion
  },
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.loading = false;
      state.error = null;
      state.lastActivity = Date.now();
      state.authLoading = false;
      state.initializationComplete = true;

      // Set axios header
      if (action.payload.token) {
        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${action.payload.token}`;
      }
    },

    clearUser: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      state.lastActivity = null;
      state.tokenRefreshing = false;
      state.authLoading = false;
      state.initializationComplete = true;

      // Clear storage and cleanup
      tokenManager.clearAllAuthData();
      tokenManager.cleanup();
    },

    updateTokenData: (state, action) => {
      if (state.user) {
        state.user.token = action.payload.token;
        state.user.tokenExpiry = action.payload.expiry;
        state.user.lastRefresh = new Date().toISOString();
      }
      state.tokenRefreshing = false;
    },

    setTokenRefreshing: (state, action) => {
      state.tokenRefreshing = action.payload;
    },

    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
    },

    setInitializationComplete: (state) => {
      state.initializationComplete = true;
      state.authLoading = false;
    },

    setAuthLoading: (state, action) => {
      state.authLoading = action.payload;
    },
  },

  extraReducers: (builder) => {
    // Initialize auth
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.authLoading = true;
        state.initializationComplete = false;
        state.error = null;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.authLoading = false;
        state.initializationComplete = true;
        if (action.payload.isAuthenticated) {
          state.user = action.payload.user;
          state.isAuthenticated = true;
          state.lastActivity = Date.now();
        } else {
          state.user = null;
          state.isAuthenticated = false;
        }
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.authLoading = false;
        state.initializationComplete = true;
        state.user = null;
        state.isAuthenticated = false;
        state.error =
          action.payload?.message || "Authentication initialization failed";
      });

    // Refresh token
    builder
      .addCase(refreshUserToken.pending, (state) => {
        state.tokenRefreshing = true;
      })
      .addCase(refreshUserToken.fulfilled, (state, action) => {
        state.tokenRefreshing = false;
        if (state.user && action.payload) {
          state.user.token = action.payload.token;
          state.user.tokenExpiry = action.payload.expiry;
          state.user.lastRefresh = new Date().toISOString();
        }
      })
      .addCase(refreshUserToken.rejected, (state, action) => {
        state.tokenRefreshing = false;
        state.error = action.payload;
        // If token refresh fails, clear user
        state.user = null;
        state.isAuthenticated = false;
        tokenManager.clearAllAuthData();
      });

    // Perform logout
    builder
      .addCase(performLogout.pending, (state) => {
        state.loading = true;
      })
      .addCase(performLogout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.loading = false;
        state.error = null;
        state.lastActivity = null;
        state.tokenRefreshing = false;
        state.authLoading = false;
      })
      .addCase(performLogout.rejected, (state, action) => {
        state.user = null;
        state.isAuthenticated = false;
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const {
  setUser,
  clearUser,
  updateTokenData,
  setTokenRefreshing,
  updateLastActivity,
  setInitializationComplete,
  setAuthLoading,
} = authSlice.actions;

// Enhanced Firebase auth state listener
export const setupAuthListener = () => (dispatch) => {
  logger.log("🔥 Setting up Firebase auth state listener...");

  let authStateInitialized = false;

  // Setup auth state listener
  const unsubscribeAuth = onAuthStateChanged(
    auth,
    async (user) => {
      logger.log("🔥 Auth state changed:", user ? "User found" : "No user");

      if (!authStateInitialized) {
        authStateInitialized = true;

        if (user) {
          try {
            const token = await user.getIdToken();
            const expiry = Date.now() + 55 * 60 * 1000;

            // Get API base URL
            const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

            // Verify token with backend to get full user data
            let backendUser = null;
            try {
              const response = await axios.post(`${baseURL}/auth/verify`, {
                id_token: token
              });
              backendUser = response.data?.user || response.data?.data?.user;
              logger.log("✅ Backend verification successful:", backendUser?.email);
            } catch (backendError) {
              console.warn("⚠️ Backend verification failed, using Firebase data only:", backendError.message);
            }

            // Combine Firebase and backend user data
            const userData = {
              // Firebase fields
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              token: token,
              tokenExpiry: expiry,
              lastRefresh: new Date().toISOString(),
              // Backend fields (if available)
              ...(backendUser && {
                id: backendUser.id,
                username: backendUser.username,
                full_name: backendUser.full_name,
                role: backendUser.role,
                is_premium: backendUser.is_premium,
                is_active: backendUser.is_active,
                is_email_verified: backendUser.is_email_verified,
                subscription_expires: backendUser.subscription_expires,
                login_provider: backendUser.login_provider,
              }),
            };

            // Check if we already have this user stored
            const storedUser =
              localStorage.getItem("user") || sessionStorage.getItem("user");
            const storage = storedUser
              ? localStorage.getItem("user")
                ? localStorage
                : sessionStorage
              : localStorage;

            storage.setItem("user", JSON.stringify(userData));
            storage.setItem("authToken", token);

            dispatch(setUser(userData));
            tokenManager.scheduleTokenRefresh(dispatch);
          } catch (error) {
            console.error("❌ Error setting up authenticated user:", error);
            dispatch(setInitializationComplete());
          }
        } else {
          dispatch(setInitializationComplete());
        }
      } else {
        // Subsequent auth state changes
        if (!user) {
          dispatch(clearUser());
        }
      }
    },
    (error) => {
      console.error("❌ Auth state change error:", error);
      dispatch(setInitializationComplete());
    }
  );

  // Setup ID token change listener for token refresh
  const unsubscribeIdToken = onIdTokenChanged(auth, async (user) => {
    if (user && authStateInitialized) {
      try {
        const token = await user.getIdToken();
        const expiry = Date.now() + 55 * 60 * 1000;

        // Update token in storage
        const storedUser =
          localStorage.getItem("user") || sessionStorage.getItem("user");
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          const updatedUser = {
            ...parsedUser,
            token,
            tokenExpiry: expiry,
            lastRefresh: new Date().toISOString(),
          };

          const storage = localStorage.getItem("user")
            ? localStorage
            : sessionStorage;
          storage.setItem("user", JSON.stringify(updatedUser));
          storage.setItem("authToken", token);

          dispatch(updateTokenData({ token, expiry }));
          tokenManager.scheduleTokenRefresh(dispatch);
        }
      } catch (error) {
        console.error("❌ Error handling token change:", error);
      }
    }
  });

  return () => {
    logger.log("🧹 Cleaning up auth listeners");
    unsubscribeAuth();
    unsubscribeIdToken();
    tokenManager.cleanup();
  };
};

export default authSlice.reducer;
