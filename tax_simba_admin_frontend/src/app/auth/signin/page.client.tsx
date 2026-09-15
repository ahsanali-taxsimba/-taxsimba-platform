"use client";
import React, { Suspense } from 'react';
import SignInPartial from './_partials/SinginPartial';

const SignInClientPage: React.FC = () => {

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
                <SignInPartial />
            </Suspense>
        </>
    );
};

export default SignInClientPage;