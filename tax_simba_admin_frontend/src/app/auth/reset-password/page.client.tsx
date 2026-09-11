"use client";
import React, { Suspense } from 'react';
import ResetPasswordSection from './_partials/ResetPasswordSection'
const ResetPasswordClientPage: React.FC = () => {

    function SignInLoading() {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <>
            <Suspense fallback={<SignInLoading />}>
                <ResetPasswordSection />
            </Suspense>
        </>
    );
};



export default ResetPasswordClientPage