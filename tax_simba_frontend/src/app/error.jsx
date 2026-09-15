"use client";

import React from "react";
import Link from "next/link";


const GlobalError = ({ error, reset }) => {

  return (
    <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
      <div className="text-center">
        <p className="fs-3">
          <span className="text-danger">Oops!</span> Something went wrong.
        </p>

        <p className="lead">
          We’re experiencing an internal server issue.
          Please try again or come back later.
        </p>

        <div className="d-flex justify-content-center gap-3 mt-4">
          <button
            onClick={() => reset()}
            className="btn btn-primary"
          >
            Try Again
          </button>

          <Link href="/" className="btn btn-outline-secondary">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default GlobalError;
