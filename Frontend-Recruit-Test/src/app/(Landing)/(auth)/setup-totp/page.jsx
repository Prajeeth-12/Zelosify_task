"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

export default function SetupTOTPPage() {
  const [qrCode, setQrCode] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("totpSetup");
      if (stored) {
        const parsed = JSON.parse(stored);
        setQrCode(parsed.qrCode);
      }
    } catch (e) {
      console.error("Failed to load TOTP setup data:", e);
    }
    setIsReady(true);
  }, []);

  const handleContinueToLogin = useCallback(() => {
    // Clear the TOTP setup data from localStorage
    localStorage.removeItem("totpSetup");

    // Clear the registration_token cookie so middleware stops redirecting here
    document.cookie =
      "registration_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";

    // Redirect to login
    window.location.href = "/login";
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg"
    >
      <div className="flex flex-col justify-center items-center gap-2 mb-6">
        <img
          src="/assets/logos/zelosify_Dark.png"
          alt="Zelosify Logo"
          width={120}
          height={40}
        />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center">
          Setup Two-Factor Authentication
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mt-2">
          Scan the QR code below with your authenticator app (Google
          Authenticator, Authy, etc.)
        </p>
      </div>

      {qrCode ? (
        <div className="flex flex-col items-center gap-6">
          <div className="p-4 bg-white rounded-lg shadow-inner">
            <img
              src={qrCode}
              alt="TOTP QR Code"
              width={200}
              height={200}
              className="mx-auto"
            />
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 w-full">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Important:</strong> Save this QR code in your
              authenticator app before continuing. You will need the generated
              code to log in.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleContinueToLogin}
            className="w-full bg-black dark:bg-white text-white dark:text-black py-2 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors duration-200"
          >
            I&apos;ve Saved My QR Code — Continue to Login
          </motion.button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-red-500 text-sm">
            No QR code found. Please register again.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              document.cookie =
                "registration_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
              window.location.href = "/register";
            }}
            className="w-full bg-black dark:bg-white text-white dark:text-black py-2 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors duration-200"
          >
            Go to Registration
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}
