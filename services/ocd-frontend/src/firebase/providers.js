// src/firebase/providers.js
import { GoogleAuthProvider, GithubAuthProvider } from "firebase/auth";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
  access_type: "offline",
});

const githubProvider = new GithubAuthProvider();

export { googleProvider, githubProvider };
