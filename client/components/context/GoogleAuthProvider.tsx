"use client";

import React from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";

// Scoped to the screens that use Google login (Auth, Settings) so the
// gsi/client script only loads there instead of on every page.
const GoogleAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) {
        console.error("Google Client ID is not configured. Google login will not work.");
    }

    return <GoogleOAuthProvider clientId={clientId || ""}>{children}</GoogleOAuthProvider>;
};

export default GoogleAuthProvider;
